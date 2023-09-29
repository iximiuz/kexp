/* eslint-disable @typescript-eslint/ban-ts-comment */
import { defineStore, acceptHMRUpdate } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { reactive } from "vue";

import type Stream from "../api/Stream";
import { splitGV } from "../common/kubeutil";
import type {
  ClusterUID,
  KubeContext,
  KubeObject,
  KubeObjectDescriptor,
  KubeObjectIdent,
  KubeObjectMap,
  KubeResource,
  KubeResourceGroup,
  KubeSelector,
  RawKubeObject,
} from "../common/types";

const REFRESH_PERIOD_MS = 1000;
const FRESH_MAX_AGE_MS = 2000;
const GC_MAX_AGE_MS = 2000;

export const useKubeDataStore = defineStore({
  id: "kubeDataStore",

  state: () => ({
    _contexts: [] as KubeContext[],

    _resourceGroupsByContext: {} as Record<string, KubeResourceGroup[]>,

    _objectsByResource: {} as { [key: string]: KubeObjectMap },

    _streamPromise: undefined as Promise<Stream> | undefined,

    _refreshInterval: undefined as NodeJS.Timer | undefined,
  }),

  getters: {
    contexts: (state) => {
      return (criteria?: Record<string, string>): KubeContext[] => {
        return state._contexts.filter((ctx) => {
          if (!criteria) {
            return true;
          }

          for (const key in criteria) {
            if (ctx[key as keyof KubeContext] !== criteria[key]) {
              return false;
            }
          }

          return true;
        });
      };
    },

    resourceGroups: (state) => {
      return (ctx: KubeContext): KubeResourceGroup[] => {
        if (!state._resourceGroupsByContext[ctx.name]) {
          state._resourceGroupsByContext[ctx.name] = [];
        }
        return state._resourceGroupsByContext[ctx.name];
      };
    },

    resource(): (ctx: KubeContext, groupVersion: string, kind: string) => KubeResource | null {
      return (ctx, groupVersion, kind) => {
        const groups = this.resourceGroups(ctx);
        for (const gr of groups) {
          if (gr.groupVersion === groupVersion) {
            for (const res of (gr.resources || [])) {
              if (res.kind === kind) {
                return res;
              }
            }
          }
        }

        return null;
      };
    },

    objects: (state) => {
      return (ctx: KubeContext, res: KubeResource): KubeObjectMap => {
        const key = _resourceKey(ctx.clusterUID, res);
        if (!state._objectsByResource[key]) {
          state._objectsByResource[key] = {};
        }
        return state._objectsByResource[key];
      };
    },
  },

  actions: {
    async fetchContexts() {
      if (this._contexts.length > 0) {
        // It's unlikely that contexts will change during the lifetime of the app.
        return;
      }

      // @ts-ignore-next-line
      this._contexts = await this.resKubeContexts.list();
      return this._contexts;
    },

    async fetchResources(ctx: KubeContext) {
      if (this.resourceGroups(ctx).length > 0) {
        // It's unlikely that resources will change during the lifetime of the app.
        return;
      }

      // @ts-ignore
      const groups = (await this.resKubeResources.list(ctx.name)).map((gr: KubeResourceGroup) => {
        for (const res of (gr.resources || [])) {
          res.groupVersion = gr.groupVersion;
        }
        return gr;
      });

      this.resourceGroups(ctx).length = 0;
      this.resourceGroups(ctx).push(...groups);
      return this.resourceGroups(ctx);
    },

    async fetchObjects(ctx: KubeContext, resource: KubeResource, selector?: KubeSelector): Promise<[KubeObjectMap, () => void]> {
      this._ensureRefreshLoop();

      const fetchId = uuidv4().split("-")[0];

      // @ts-ignore-next-line
      const rawObjects = Object.fromEntries((await this.resKubeObjects.list(
        ctx.name,
        resource.groupVersion,
        resource.name,
        selector,
      )).map((rawObj: RawKubeObject) => [_objectIdent(ctx.clusterUID, resource, rawObj), rawObj]));

      const toReturn = {} as { [key: string]: KubeObject };
      const now = Date.now();
      const existingObjects = this.objects(ctx, resource);
      for (const ident in rawObjects) {
        if (existingObjects[ident]) {
          existingObjects[ident]._patch(rawObjects[ident], now);
        } else {
          existingObjects[ident] = _bakedObject(ctx.clusterUID, resource, rawObjects[ident]);
          existingObjects[ident]._refresh(now);
        }
        toReturn[ident] = existingObjects[ident];
        toReturn[ident]._usedBy[fetchId] = true;
      }

      // Remove existing objects that weren't found in the fresh fetch.
      // Caveat: this will not invalidate refs to these objects stored
      // outside of the `this._objectsByResource` collection.
      for (const ident in existingObjects) {
        if (!rawObjects[ident]) {
          existingObjects[ident]._lostAt = now; // mostly for debugging
          delete existingObjects[ident];
        }
      }

      return [
        toReturn,
        () => {
          Object.values(toReturn).forEach((obj) => {
            delete obj._usedBy[fetchId];
            if (Object.keys(obj._usedBy).length === 0) {
              this._evictObject(obj);
            }
          });
        },
      ];
    },

    async watchObjects(
      ctx: KubeContext,
      resource: KubeResource,
      selector?: KubeSelector,
      callback?: (err: Error | null, obj?: KubeObject) => void,
    ) {
      this._ensureRefreshLoop();

      if (!this._streamPromise) {
        this._streamPromise = (async() => {
          // @ts-ignore-next-line
          const stream = this.streamProvider();
          await stream.connect();
          console.debug("kubeDataStore: stream connected");
          return stream;
        })();
      }

      const stream = await this._streamPromise;
      const watchId = stream.watchKubeObjects(ctx, resource, selector || {}, (err: Error | null, rawObj: RawKubeObject | null, event?: { deleted?: boolean }) => {
        if (err || !rawObj) {
          console.error("kubeDataStore: stream watch error", err);
          if (callback) {
            callback(err);
          }
          return;
        }

        const now = Date.now();
        const ident = _objectIdent(ctx.clusterUID, resource, rawObj);
        const objects = this.objects(ctx, resource);
        if (objects[ident]) {
          objects[ident]._patch(rawObj, now);
        } else {
          objects[ident] = _bakedObject(ctx.clusterUID, resource, rawObj);
          objects[ident]._refresh(now);
        }

        if (event && event.deleted) {
          objects[ident].deletedAt = now;
        }

        objects[ident]._usedBy[watchId] = true;

        if (callback) {
          try {
            callback(null, objects[ident]);
          } catch (e) {
            console.warn("kubeDataStore: watch callback failed", e);
          }
        }
      });

      return () => {
        stream.unwatchKubeObjects(watchId);

        Object.values(this.objects(ctx, resource)).forEach((obj) => {
          delete obj._usedBy[watchId];
          if (Object.keys(obj._usedBy).length === 0) {
            this._evictObject(obj);
          }
        });
      };
    },

    async updateObject(ctx: KubeContext, obj: KubeObject, manifest: object) {
      this._ensureRefreshLoop();

      // @ts-ignore-next-line
      const rawObj = await this.resKubeObjects.update(
        ctx.name,
        obj.resource.groupVersion,
        obj.resource.name,
        obj.name,
        obj.namespace,
        manifest,
      );

      obj._patch(rawObj, Date.now());
    },

    async deleteObject(ctx: KubeContext | null, obj: KubeObject) {
      this._ensureRefreshLoop();

      const contexts = ctx
        ? [ctx]
        : this.contexts({ clusterUID: obj.clusterUID });

      if (contexts.length === 0) {
        throw new Error(`No context found for cluster ${obj.clusterUID}`);
      }

      const errors: Error[] = [];
      for (const ctx of contexts) {
        try {
          // @ts-ignore-next-line
          await this.resKubeObjects.delete(
            ctx.name,
            obj.resource.groupVersion,
            obj.resource.name,
            obj.name,
            obj.namespace,
          );

          obj.updatedAt = Date.now();
          // Don't set deletedAt - wait until the corresponding watch event.
          // TODO: Understand the impact on deletion of objects that are not watched.

          return;
        } catch (e) {
          errors.push(e as Error);
        }
      }

      throw new Error(`Failed to delete object ${obj.ident}: ${errors.map((e) => e.message).join("; ")}`);
    },

    _ensureRefreshLoop() {
      if (this._refreshInterval) {
        return;
      }

      this._refreshInterval = setInterval(() => {
        const now = Date.now();

        for (const resKey in this._objectsByResource) {
          const objects = this._objectsByResource[resKey];
          for (const ident in objects) {
            const obj = objects[ident];
            obj._refresh();

            // Garbage collection.
            const oldDeleted = obj.deletedAt && now - obj.deletedAt > GC_MAX_AGE_MS;
            const abandoned = Object.keys(obj._usedBy).length === 0;
            if (oldDeleted || abandoned) {
              this._evictObject(obj);
            }
          }
        }
      }, REFRESH_PERIOD_MS);
    },

    _evictObject(obj: KubeObject) {
      const objects = this._objectsByResource[_resourceKey(obj.clusterUID, obj.resource)];
      if (objects && objects[obj.ident]) {
        objects[obj.ident].evicted = true;
        delete objects[obj.ident];
      }
    },
  },
});

function _bakedObject(clusterUID: string, resource: KubeResource, rawObj: RawKubeObject): KubeObject {
  // TODO: console.assert(rawObj is not reactive);

  const ident = _objectIdent(clusterUID, resource, rawObj);
  const [group, version] = splitGV(rawObj.apiVersion);
  return reactive<KubeObject>({
    descriptor: {
      ident,
      name: rawObj.metadata.name,
      namespace: rawObj.metadata.namespace,
      resource,
    } as KubeObjectDescriptor,
    rev: 1,
    ident,
    updatedAt: +new Date(rawObj.metadata.creationTimestamp),
    gvk: {
      group,
      version,
      kind: rawObj.kind,
      toString() { return rawObj.apiVersion + "/" + rawObj.kind; },
    },
    name: rawObj.metadata.name!,
    namespace: rawObj.metadata.namespace,
    clusterUID,
    resource,
    raw: rawObj,

    _usedBy: {}, // For internal use only - garbage collection is based on this field.

    isOwner(other) {
      return other.isOwnedBy(this);
    },

    isOwnedBy(other) {
      return !!(this.raw.metadata.ownerReferences || []).find((ref) => {
        return splitGV(ref.apiVersion)[0] === other.gvk.group &&
          ref.kind === other.gvk.kind &&
          ref.name === other.name &&
          ref.uid === other.raw.metadata.uid &&
          (!this.resource.namespaced || other.namespace === this.namespace);
      });
    },

    isSame(other: { resource: KubeResource; name: string; namespace?: string; }) {
      return this.resource.groupVersion === other.resource.groupVersion &&
        this.resource.kind === other.resource.kind &&
        this.isEponymous(other);
    },

    isEponymous(other: { name: string; namespace?: string; }) {
      return this.name === other.name &&
        (
          (this.resource.namespaced && this.namespace === other.namespace) ||
          (!this.resource.namespaced && !other.namespace)
        );
    },

    ownerRefs() {
      return (this.raw.metadata.ownerReferences || []).map((ref) => _objectIdent(clusterUID, resource, {
        metadata: { name: ref.name },
      }));
    },

    _patch(newRaw, now) {
      if (this.raw.metadata.resourceVersion === newRaw.metadata.resourceVersion) {
        return;
      }

      this.rev++;
      this.raw = newRaw;
      this.updatedAt = now || Date.now();

      // Check if objects with exactly the same identity has been recreated before eviction.
      if (this.deletedAt && !newRaw.metadata.deletionTimestamp) {
        delete this.deletedAt;

        if (this.evicted) {
          delete this.evicted;
        }
      }

      this._refresh();
    },

    _refresh(now) {
      now = now || Date.now();

      const qualifiesAsFreshlyCreated = (() => {
        if (this.deletedAt || this.raw.metadata.deletionTimestamp) {
          return false;
        }

        const createdAt = +new Date(this.raw.metadata.creationTimestamp);
        return now - createdAt < FRESH_MAX_AGE_MS;
      })();

      const qualifiesAsFreshlyUpdated = (() => {
        if (this.deletedAt || this.raw.metadata.deletionTimestamp) {
          return false;
        }
        if (qualifiesAsFreshlyCreated) {
          return false;
        }

        return this.updatedAt && now - this.updatedAt < FRESH_MAX_AGE_MS;
      })();

      if (qualifiesAsFreshlyCreated && !this.isFreshlyCreated) {
        this.isFreshlyCreated = true;
        this.rev++;
      }
      if (!qualifiesAsFreshlyCreated && this.isFreshlyCreated) {
        delete this.isFreshlyCreated;
        this.rev++;
      }

      if (qualifiesAsFreshlyUpdated && !this.isFreshlyUpdated) {
        this.isFreshlyUpdated = true;
        this.rev++;
      }
      if (!qualifiesAsFreshlyUpdated && this.isFreshlyUpdated) {
        delete this.isFreshlyUpdated;
        this.rev++;
      }
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useKubeDataStore, import.meta.hot));
}

// Ident cannot be based on the object's uid because:
//   - the UID is not known until the object is created
//   - the UID changes if the object is deleted and recreated with the same name
function _objectIdent(
  clusterUID: ClusterUID,
  resource: KubeResource,
  rawObj: { metadata: { namespace?: string; name: string; }; },
): KubeObjectIdent {
  const resIdent = `${clusterUID}/${resource.groupVersion}/${resource.kind}`;
  const objIdent = resource.namespaced
    ? `${rawObj.metadata.namespace}/${rawObj.metadata.name}`
    : rawObj.metadata.name;
  return `${resIdent}/${objIdent}`;
}

function _resourceKey(clusterUID: ClusterUID, resource: KubeResource): string {
  return `${clusterUID}/${resource.groupVersion}/${resource.kind}`;
}
