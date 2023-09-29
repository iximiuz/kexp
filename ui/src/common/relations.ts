/* eslint-disable @typescript-eslint/ban-ts-comment */
import { splitGVK } from "./kubeutil";

import type {
  KubeObject,
  KubeObjectMap,
  KubeResource,
  KubeResourceGroup,
  RawKubeObject,
  V1Service,
} from "./types";
import {
  isCoreV1Event,
  isV1Pod,
} from "./types";

const relations: {
  [groupVersionKind: string]: <T extends RawKubeObject, O extends RawKubeObject>(target: KubeObject<T>) => {
    [groupVersion: string]: {
      [kind: string]: ((target: KubeObject<T>, obj: KubeObject<O>) => boolean) | { via: string; },
    };
  };
} = {
  "apps/v1/ControllerRevision": () => ({
    "apps/v1": {
      DaemonSet: (target, ds) => target.isOwnedBy(ds),
      StatefulSet: (target, ss) => target.isOwnedBy(ss),
    },
  }),
  "apps/v1/DaemonSet": () => ({
    "apps/v1": {
      ControllerRevision: (target, cr) => cr.isOwnedBy(target),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => pod.isOwnedBy(target),
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "apps/v1/Deployment": () => ({
    "apps/v1": {
      ReplicaSet: (target, rs) => rs.isOwnedBy(target),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: { via: "apps/v1/ReplicaSet" },
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "apps/v1/ReplicaSet": () => ({
    "apps/v1": {
      Deployment: (target, dep) => target.isOwnedBy(dep),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => pod.isOwnedBy(target),
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "apps/v1/StatefulSet": () => ({
    "apps/v1": {
      ControllerRevision: (target, cr) => cr.isOwnedBy(target),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => pod.isOwnedBy(target),
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "batch/v1/CronJob": () => ({
    "batch/v1": {
      Job: (target, job) => job.isOwnedBy(target),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: { via: "batch/v1/Job" },
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "batch/v1/Job": () => ({
    "batch/v1": {
      CronJob: (target, cj) => target.isOwnedBy(cj),
    },
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => pod.isOwnedBy(target),
      Secret: { via: "v1/Pod" },
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "discovery.k8s.io/v1/EndpointSlice": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
    },
    v1: {
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Pod: { via: "v1/Service" },
      Service: (target, svc) => target.isOwnedBy(svc),
    },
  }),
  "v1/ConfigMap": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
    },
    v1: {
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Pod: _configMapRelatesToPod,
    },
  }),
  "v1/Endpoints": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
    },
    v1: {
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Pod: { via: "v1/Service" },
      Service: (target, svc) => target.isEponymous(svc),
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "v1/Event": (target) => {
    if (!isCoreV1Event(target.raw)) {
      return {};
    }

    const involvedObject = target.raw.involvedObject;

    return {
      [involvedObject.apiVersion!]: {
        [involvedObject.kind!]: (target, obj) => obj.isEponymous(involvedObject),
      },
    };
  },
  "v1/Namespace": () => ({
    v1: {
      ServiceAccount: (target, sa) => target.name === sa.namespace,
    },
  }),
  "v1/Node": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
    },
    v1: {
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Pod: (target, pod) => isV1Pod(pod.raw) && target.name === pod.raw.spec!.nodeName,
      Service: { via: "v1/Pod" },
    },
  }),
  "v1/Pod": () => ({
    "apps/v1": {
      DaemonSet: (target, ds) => target.isOwnedBy(ds),
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: (target, rs) => target.isOwnedBy(rs),
      StatefulSet: (target, ss) => target.isOwnedBy(ss),
    },
    "batch/v1": {
      CronJob: { via: "batch/v1/Job" },
      Job: (target, job) => target.isOwnedBy(job),
    },
    v1: {
      ConfigMap: (target, cm) => _configMapRelatesToPod(cm, target),
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: (target, node) => isV1Pod(target.raw) && target.raw.spec!.nodeName === node.name,
      ReplicationController: (target, rc) => target.isOwnedBy(rc),
      Secret: (target, sec) => _secretRelatesToPod(sec, target),
      Service: (target, svc) => Object.entries((svc.raw as V1Service).spec!.selector || {})
        .some(([key, val]) => (target.raw.metadata.labels || {})[key] === val),
      ServiceAccount: (target, sa) => target.namespace === sa.namespace && isV1Pod(target.raw) && (target.raw.spec!.serviceAccountName || "default") === sa.name,
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "v1/ReplicationController": () => ({
    v1: {
      ConfigMap: { via: "v1/Pod" },
      Endpoints: { via: "v1/Service" },
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => pod.isOwnedBy(target),
      Service: { via: "v1/Pod" },
      ServiceAccount: { via: "v1/Pod" },
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: { via: "v1/Service" },
    },
  }),
  "v1/Secret": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
    },
    v1: {
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Pod: _secretRelatesToPod,
    },
  }),
  "v1/Service": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
    },
    v1: {
      Endpoints: (target, es) => target.isEponymous(es),
      Event: (target, evt) => _eventRelatesToObject(evt, target),
      Namespace: (target, ns) => target.namespace === ns.name,
      Node: { via: "v1/Pod" },
      Pod: (target, pod) => Object.entries((target.raw as V1Service).spec!.selector || {})
        .some(([key, val]) => (pod.raw.metadata.labels || {})[key] === val),
    },
    "discovery.k8s.io/v1": {
      EndpointSlice: (target, es) => es.isOwnedBy(target),
    },
  }),
  "v1/ServiceAccount": () => ({
    "apps/v1": {
      DaemonSet: { via: "v1/Pod" },
      Deployment: { via: "apps/v1/ReplicaSet" },
      ReplicaSet: { via: "v1/Pod" },
      StatefulSet: { via: "v1/Pod" },
    },
    v1: {
      Namespace: (target, ns) => target.namespace === ns.name,
      Pod: (target, pod) => target.namespace === pod.namespace && isV1Pod(pod.raw) && (pod.raw.spec!.serviceAccountName || "default") === target.name,
    },
  }),
};

export function isApplicationKindOfResource(gvk: string): boolean {
  return {
    "apps/v1/DaemonSet": true,
    "apps/v1/Deployment": true,
    "apps/v1/ReplicaSet": true,
    "apps/v1/StatefulSet": true,
    "batch/v1/CronJob": true,
    "batch/v1/Job": true,
    "v1/ConfigMap": true,
    "v1/Pod": true,
    "v1/ReplicationController": true,
    "v1/Secret": true,
    "v1/Service": true,
    "v1/ServiceAccount": true,
  }[gvk] || false;
}

export function objectRelations(obj: KubeObject) {
  return (relations[obj.gvk.toString()] || (() => ({})))(obj);
}

export function isRelatedResourceGroup(target: KubeObject, rg: KubeResourceGroup) {
  const related = objectRelations(target);
  return Object.keys(related[rg.groupVersion] || {}).length > 0;
}

export function isRelatedResource(target: KubeObject, res: KubeResource) {
  const related = objectRelations(target);
  return !!(related[res.groupVersion] || {})[res.kind];
}

export function relatedObjects(
  objects: Record<string, Record<string, KubeObjectMap>>,
  target: KubeObject,
): Record<string, Record<string, KubeObjectMap>> {
  const related: Record<string, Record<string, KubeObjectMap>> = {};

  const targetRelations = objectRelations(target);
  while (Object.values(targetRelations).some((kinds) => Object.keys(kinds).length > 0)) {
    for (const gv in targetRelations) {
      if (!objects[gv]) {
        delete targetRelations[gv];
        continue;
      }

      for (const kind in targetRelations[gv]) {
        if (!objects[gv][kind]) {
          delete targetRelations[gv][kind];
          continue;
        }

        // @ts-ignore-next-line
        if (targetRelations[gv][kind].via) {
          // @ts-ignore-next-line
          const [viagv, viakind] = splitGVK(targetRelations[gv][kind].via);
          if (!objects[viagv] || !objects[viagv][viakind]) {
            delete targetRelations[gv][kind];
            continue;
          }

          if (!related[viagv] || !related[viagv][viakind]) {
            if (!targetRelations[viagv] || !targetRelations[viagv][viakind]) {
              // No chance of finding any related objects anymore.
              delete targetRelations[gv][kind];
            } else {
              // We'll have to revisit this one later.
            }
            continue;
          }

          for (const rel of Object.values(related[viagv][viakind])) {
            const relations = objectRelations(rel); // relative's relations
            if (!relations[gv] || !relations[gv][kind]) {
              continue;
            }

            // Checking for transitive relations.
            for (const obj of Object.values(objects[gv][kind])) {
              // @ts-ignore-next-line
              if (relations[gv][kind](rel, obj)) {
                related[gv] = related[gv] || {};
                related[gv][kind] = related[gv][kind] || {};
                related[gv][kind][obj.ident] = obj;
              }
            }
          }
          delete targetRelations[gv][kind];
        } else {
          for (const obj of Object.values(objects[gv][kind])) {
            if (typeof targetRelations[gv][kind] !== "function") {
              console.warn(`Invalid relation for ${gv}/${kind}`, target, targetRelations);
            // @ts-ignore
            } else if (targetRelations[gv][kind](target, obj)) {
              related[gv] = related[gv] || {};
              related[gv][kind] = related[gv][kind] || {};
              related[gv][kind][obj.ident] = obj;
            }
          }
          delete targetRelations[gv][kind];
        }
      }
    }
  }

  return related;
}

function _eventRelatesToObject(evt: KubeObject, obj: KubeObject): boolean {
  return isCoreV1Event(evt.raw) && obj.isEponymous(evt.raw.involvedObject) && evt.raw.involvedObject.uid === obj.raw.metadata.uid;
}

function _configMapRelatesToPod(cm: KubeObject, pod: KubeObject): boolean {
  if (!isV1Pod(pod.raw) || pod.namespace !== cm.namespace) {
    return false;
  }

  const containers = pod.raw.spec!.containers || [];
  if (containers.some((c) => (c.envFrom || []).some((e) => e.configMapRef && e.configMapRef.name === cm.name))) {
    return true;
  }

  if (containers.some((c) => (c.env || []).some((e) => e.valueFrom && e.valueFrom.configMapKeyRef && e.valueFrom.configMapKeyRef.name === cm.name))) {
    return true;
  }

  const volumes = pod.raw.spec!.volumes || [];
  if (volumes.some((v) => v.configMap && v.configMap.name === cm.name)) {
    return true;
  }

  return false;
}

function _secretRelatesToPod(sec: KubeObject, pod: KubeObject): boolean {
  if (!isV1Pod(pod.raw) || pod.namespace !== sec.namespace) {
    return false;
  }

  const containers = pod.raw.spec!.containers || [];
  if (containers.some((c) => (c.envFrom || []).some((e) => e.secretRef && e.secretRef.name === sec.name))) {
    return true;
  }

  if (containers.some((c) => (c.env || []).some((e) => e.valueFrom && e.valueFrom.secretKeyRef && e.valueFrom.secretKeyRef.name === sec.name))) {
    return true;
  }

  const volumes = pod.raw.spec!.volumes || [];
  if (volumes.some((v) => v.secret && v.secret.secretName === sec.name)) {
    return true;
  }

  return false;
}
