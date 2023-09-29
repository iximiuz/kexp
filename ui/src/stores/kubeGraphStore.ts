import { defineStore, acceptHMRUpdate } from "pinia";

import type {
  KubeObject,
  KubeObjectIdent,
} from "../common/types";

const GC_PERIOD_MS = 10000;

interface KubeGraphStoreState {
  _objects: Record<KubeObjectIdent, {
    object: KubeObject;
    providers: Record<string, boolean>;
  }>;

  _highlighted: KubeObject[];

  _gcInterval: NodeJS.Timer | null;
}

export const useKubeGraphStore = defineStore({
  id: "kubeGraphStore",

  state: (): KubeGraphStoreState => ({
    _objects: {},

    _highlighted: [],

    _gcInterval: null,
  }),

  getters: {
    objects: (state) => {
      return Object.values(state._objects)
        .filter((obj) => !obj.object.evicted && Object.keys(obj.providers).length > 0)
        .map((obj) => obj.object);
    },

    highlighted: (state) => {
      return state._highlighted;
    },

    isEmpty: (state) => {
      return Object.keys(state._objects).length === 0;
    },
  },

  actions: {
    upsertObject(provider: string, ko: KubeObject) {
      if (!this._objects[ko.ident]) {
        this._objects[ko.ident] = {
          object: ko,
          providers: {},
        };
      }

      this._objects[ko.ident].providers[provider] = true;
    },

    removeObject(provider: string, ko: KubeObject) {
      if (!this._objects[ko.ident]) {
        return;
      }

      delete this._objects[ko.ident].providers[provider];
      if (Object.keys(this._objects[ko.ident].providers).length === 0) {
        delete this._objects[ko.ident];
      }
    },

    removeAllObjects(provider: string) {
      Object.keys(this._objects).forEach((ident) => {
        if (this._objects[ident].providers[provider]) {
          delete this._objects[ident].providers[provider];
          if (Object.keys(this._objects[ident].providers).length === 0) {
            delete this._objects[ident];
          }
        }
      });
    },

    highlightObjects(kos: KubeObject[]) {
      this._highlighted = kos;
    },

    _ensureGCLoop() {
      if (this._gcInterval) {
        return;
      }

      this._gcInterval = setInterval(() => {
        Object.keys(this._objects).forEach((ident) => {
          const obj = this._objects[ident];
          if (Object.keys(obj.providers).length === 0 || obj.object.evicted) {
            delete this._objects[ident];
          }
        });
      }, GC_PERIOD_MS);
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useKubeGraphStore, import.meta.hot));
}
