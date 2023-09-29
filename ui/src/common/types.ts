import type {
  CoreV1Event as _CoreV1Event,
  KubernetesObject as _KubernetesObject,
  V1ConfigMap as _V1ConfigMap,
  V1Container as _V1Container,
  V1ObjectMeta as _V1ObjectMeta,
  V1Pod as _V1Pod,
  V1Secret as _V1Secret,
  V1Service as _V1Service,
} from "@kubernetes/client-node";

export type ClusterUID = string;

export interface KubeContext {
  name: string;
  cluster: string;
  clusterUID: ClusterUID;
  user: string;
}

export interface KubeResource {
  groupVersion: string;
  kind: string;
  name: string;
  namespaced: boolean;
  shortNames?: string[];
}

export interface KubeResourceGroup {
  groupVersion: string;
  resources?: KubeResource[];
}

export type KubeObjectIdent = string;

export interface KubeObjectDescriptor {
  ident: KubeObjectIdent;
  name: string;
  namespace: string;
  resource: KubeResource;
}

type DateToISOString<T> = {
  [P in keyof T]: T[P] extends Date
    ? string
    : T[P] extends Array<unknown>
      ? Array<DateToISOString<T[P][number]>>
      : T[P] extends Record<string, unknown>
        ? { [K in keyof T[P]]: DateToISOString<T[P][K]> }
        : T[P] extends object
          ? DateToISOString<T[P]>
          : T[P];
};

export type V1ObjectMeta = DateToISOString<Required<Pick<_V1ObjectMeta, "name" | "creationTimestamp">> & Omit<_V1ObjectMeta, "name" | "creationTimestamp">>;

export type RawKubeObject = Required<Pick<_KubernetesObject, "apiVersion" | "kind">> & Omit<_V1ObjectMeta, "apiVersion" | "kind" | "metadata"> & { metadata: V1ObjectMeta };

export type RawKubeObjectWithStatus = RawKubeObject & { status?: unknown };

export type CoreV1Event = Omit<_CoreV1Event, keyof RawKubeObject> & RawKubeObject;

export function isCoreV1Event(raw: RawKubeObject): raw is CoreV1Event {
  return raw.apiVersion === "v1" && raw.kind === "Event";
}

export type V1ConfigMap = Omit<_V1ConfigMap, keyof RawKubeObject> & RawKubeObject;

export type V1Pod = Omit<_V1Pod, keyof RawKubeObject> & RawKubeObject;

export function isV1Pod(raw: RawKubeObject): raw is V1Pod {
  return raw.apiVersion === "v1" && raw.kind === "Pod";
}

export type V1Container = DateToISOString<_V1Container>;

export type V1Secret = Omit<_V1Secret, keyof RawKubeObject> & RawKubeObject;

export type V1Service = Omit<_V1Service, keyof RawKubeObject> & RawKubeObject;

export interface KubeObject<R = RawKubeObject> {
  descriptor: KubeObjectDescriptor;
  ident: KubeObjectIdent;
  rev: number;
  gvk: {
    group: string;
    version: string;
    kind: string;
    toString(): string;
  };
  name: string;
  namespace?: string;
  clusterUID: ClusterUID;
  resource: KubeResource;
  raw: R,

  updatedAt: number;
  deletedAt?: number;

  focused?: boolean;
  evicted?: boolean;

  isFreshlyCreated?: boolean;
  isFreshlyUpdated?: boolean;
  isFreshlyDeleted?: boolean;

  isOwner(other: KubeObject): boolean;
  isOwnedBy(other: KubeObject): boolean;
  isSame(other: { resource: KubeResource; name: string; namespace?: string }): boolean;
  isEponymous(other: { name?: string; namespace?: string }): boolean;
  ownerRefs(): string[];

  _patch(newRaw: RawKubeObject, now?: number): void;
  _refresh(now?: number): void;

  _usedBy: { [key: string]: boolean };
  _lostAt?: number;
}

export type KubeObjectMap<T = KubeObject> = Record<KubeObjectIdent, T>;

export interface KubeSelector {
  labels?: string;
  fields?: string;
  namespace?: string;
  name?: string;
}
