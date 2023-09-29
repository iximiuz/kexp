import { useKubeDataStore } from "../stores";

import { useCleaner } from "./cleaner";
import { isRelatedResource, isRelatedResourceGroup, relatedObjects } from "./relations";
import type {
  KubeContext,
  KubeObjectDescriptor,
  KubeObject,
  KubeObjectMap,
  KubeResource,
  KubeSelector,
} from "./types";

// TODO: Garbage collect evicted objects.

export class RelatedWatcher {
  constructor(
    private ctx: KubeContext,
    private target: KubeObjectDescriptor,
    private _targetObject: KubeObject | null = null,
    private _allObjects: Record<string, Record<string, KubeObjectMap>> = {},
    private _relatedObjects: Record<string, Record<string, KubeObjectMap>> = {},
    private _listeners: (() => void)[] = [],
    private _initialized: boolean = false,
    private _cleaner = useCleaner(),
  ) {
    this.ctx = ctx;
    this.target = target;
  }

  destroy() {
    this._cleaner.cleanUp();
  }

  objects(): KubeObject[] {
    if (!this._targetObject) {
      return [];
    }

    const objs: KubeObjectMap = {
      [this.target.ident]: this._targetObject,
    };

    for (const groupVersion in this._relatedObjects) {
      for (const kind in this._relatedObjects[groupVersion]) {
        for (const ident in this._relatedObjects[groupVersion][kind]) {
          const obj = this._relatedObjects[groupVersion][kind][ident];
          if (!obj.evicted) {
            objs[ident] = obj;
          }
        }
      }
    }

    return Object.values(objs);
  }

  async watch() {
    const loadings = [];

    const selector: KubeSelector = {
      namespace: this.target.namespace,
      name: this.target.name,
    };

    const [target, release] = await useKubeDataStore().fetchObjects(this.ctx, this.target.resource, selector);
    if (Object.keys(target).length === 0) {
      return;
    }

    this._targetObject = target[Object.keys(target)[0]];
    if (!this._cleaner.addCleanup(release)) {
      return;
    }

    const unwatch = await useKubeDataStore().watchObjects(this.ctx, this.target.resource, selector, (err, obj) => {
      if (err) {
        console.error("RelatedWatcher: watch target error", this.target, err);
        return;
      }

      if (!obj || obj.evicted) {
        this._targetObject = null;
      } else {
        this._targetObject = obj;
      }
    });
    if (!this._cleaner.addCleanup(unwatch)) {
      return;
    }

    for (const rg of useKubeDataStore().resourceGroups(this.ctx)) {
      if (isRelatedResourceGroup(this._targetObject, rg)) {
        for (const res of (rg.resources || [])) {
          if (isRelatedResource(this._targetObject, res)) {
            loadings.push(this._loadObjects(res));
          }
        }
      }
    }

    await Promise.all(loadings);
    this._initialized = true;

    this._computeRelatedObjects();
  }

  addEventListener(listener: () => void) {
    this._listeners.push(listener);
  }

  async _loadObjects(res: KubeResource) {
    const [batch, release] = await useKubeDataStore().fetchObjects(this.ctx, res);
    if (!this._cleaner.addCleanup(release)) {
      return;
    }

    _set(this._allObjects, [res.groupVersion, res.kind], batch);

    const unwatch = await useKubeDataStore().watchObjects(this.ctx, res, {} as KubeSelector, (err, obj) => {
      if (err || !obj) {
        console.error("RelatedWatcher: watch resource error", res, err);
        return;
      }

      _set(this._allObjects, [res.groupVersion, res.kind, obj.ident], obj);

      if (this._initialized) {
        // Keep the related object graph up to date.
        this._computeRelatedObjects();

        for (const fn of this._listeners) {
          fn();
        }
      }
    });
    this._cleaner.addCleanup(unwatch);
  }

  _computeRelatedObjects() {
    if (this._targetObject) {
      this._relatedObjects = relatedObjects(this._allObjects || {}, this._targetObject);
    } else {
      this._relatedObjects = {};
    }
  }
}

export class ResourceWatcher {
  constructor(
    private ctx: KubeContext,
    private res: KubeResource,
    private selector?: KubeSelector,
    private _objects: KubeObjectMap = {},
    private _listeners: (() => void)[] = [],
    private _cleaner = useCleaner(),
  ) {
    this.ctx = ctx;
    this.res = res;
    this.selector = selector;
  }

  destroy() {
    this._cleaner.cleanUp();
  }

  objects() {
    return Object.values(this._objects).filter((obj) => !obj.evicted);
  }

  async watch() {
    const [batch, release] = await useKubeDataStore().fetchObjects(this.ctx, this.res, this.selector);
    if (!this._cleaner.addCleanup(release)) {
      return;
    }

    this._objects = batch;

    const unwatch = await useKubeDataStore().watchObjects(this.ctx, this.res, this.selector, (err, obj) => {
      if (err || !obj) {
        console.error("ResourceWatcher: watch resource error", this.res, err);
        return;
      }

      this._objects[obj.ident] = obj;

      for (const fn of this._listeners) {
        fn();
      }
    });
    this._cleaner.addCleanup(unwatch);
  }

  addEventListener(listener: () => void) {
    this._listeners.push(listener);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _set(obj: any, path: string[], value: unknown): void {
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!obj[key]) {
      obj[key] = {} as object;
    }
    obj = obj[key];
  }

  obj[path[path.length - 1]] = value;
}
