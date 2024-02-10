import yaml from "js-yaml";

import type { KubeObject, RawKubeObject, RawKubeObjectWithStatus, V1Pod } from "./types";

export function reprYaml(obj: KubeObject): string {
  return yaml.dump(pretty(obj));
}

export function reprYamlNoStatus(obj: KubeObject): string {
  return yaml.dump({ ...pretty(obj), status: undefined });
}

export function reprYamlStatusOnly<T extends RawKubeObjectWithStatus>(obj: KubeObject<T>): string {
  return yaml.dump({ status: pretty(obj).status });
}

export function reprJson(obj: KubeObject): string {
  return JSON.stringify(pretty(obj), null, 2);
}

export function reprJsonNoStatus(obj: KubeObject): string {
  return JSON.stringify({ ...pretty(obj), status: undefined }, null, 2);
}

export function reprJsonStatusOnly<T extends RawKubeObjectWithStatus>(obj: KubeObject<T>): string {
  return JSON.stringify({ status: pretty(obj).status }, null, 2);
}

export function reprYamlLastApplied(obj: KubeObject): string | undefined {
  const config = (obj.raw.metadata.annotations || {})["kubectl.kubernetes.io/last-applied-configuration"];
  return config ? yaml.dump(JSON.parse(config)) : undefined;
}

function pretty<T extends RawKubeObject>(obj: KubeObject<T>): T {
  return {
    ...obj.raw,
    metadata: { ...obj.raw.metadata, managedFields: undefined },
  };
}

export type PodPhase = "Unknown" | "Pending" | "NotReady" | "Ready" | "Succeeded" | "Failed";

export interface PodPhaseRepr {
  phase: PodPhase;
  title: string;
  reason?: string;
  message?: string;
}

export function reprPodPhase(pod: V1Pod): PodPhaseRepr {
  // TODO: add the STATUS-like info from the kubectl get pod command.

  if (!pod.status || !pod.status.phase) {
    return {
      phase: "Unknown",
      title: "Unknown",
      reason: "No Pod status field",
    };
  }

  if (pod.status.phase !== "Running") {
    return {
      phase: pod.status.phase as PodPhase,
      title: pod.status.phase,
    };
  }

  if (pod.status.phase === "Running") {
    if ((pod.status.conditions || []).find((c) => c.type === "Ready" && c.status === "True")) {
      return {
        phase: "Ready",
        title: "Running (Ready)",
      };
    }

    return {
      phase: "NotReady",
      title: "Running (Not Ready)",
    };
  }

  return {
    phase: "Unknown",
    title: "Unknown",
    reason: "Unknown Pod phase",
  };
}

export const podPhaseClass = {
  Pending: "status-waiting",
  NotReady: "status-not-ready",
  Ready: "status-ready",
  Succeeded: "status-terminated-ok",
  Failed: "status-terminated-ko",
  Unknown: "status-unknown",
} as Record<PodPhase, string>;

export interface ContainerStatusRepr {
  status: "waiting" | "starting" | "not-ready" | "ready" | "terminated-ok" | "terminated-ko" | "unknown";
  title: string;
  reason?: string;
  message?: string;
}

export function reprContainerStatus(pod: V1Pod, name: string, opts?: { kind: "ephemeral" | "init" | "sidecar" | "regular" }): ContainerStatusRepr {
  if (!pod.status) {
    return {
      status: "unknown",
      title: "No Pod status field",
    };
  }

  const statuses = opts && (opts.kind === "init" || opts.kind === "sidecar")
    ? pod.status.initContainerStatuses
    : (opts && opts.kind === "ephemeral")
      ? pod.status.ephemeralContainerStatuses
      : pod.status.containerStatuses;
  if (!statuses) {
    return {
      status: "unknown",
      title: "No container statuses field",
    };
  }

  const status = statuses.find((c) => c.name === name);
  if (!status || !status.state) {
    return {
      status: "unknown",
      title: "Container status not found",
    };
  }

  if (status.state.waiting) {
    return {
      status: "waiting",
      title: "Waiting",
      reason: status.state.waiting.reason,
      message: status.state.waiting.message,
    };
  }

  if (opts && (opts.kind === "init" || opts.kind === "ephemeral") && status.state.running) {
    return {
      status: "ready",
      title: "Running",
    };
  }

  if (status.state.running && !status.started) {
    return {
      status: "starting",
      title: "Starting",
      reason: "awaiting startup probe",
    };
  }

  if (status.state.running && !status.ready) {
    return {
      status: "not-ready",
      title: "Running but not ready",
    };
  }

  if (status.state.running && status.ready) {
    return {
      status: "ready",
      title: "Running and ready",
    };
  }

  if (status.state.terminated) {
    return {
      status: (status.state.terminated.exitCode === 0 ? "terminated-ok" : "terminated-ko"),
      title: (status.state.terminated.exitCode === 0 ? "Terminated successfully" : "Terminated with error"),
      reason: status.state.terminated.reason,
      message: status.state.terminated.message,
    };
  }

  return {
    status: "unknown",
    title: "unknown condition",
  };
}

export function reprInitContainerStatus(pod: V1Pod, name: string): ContainerStatusRepr {
  return reprContainerStatus(pod, name, { kind: "init" });
}

export function reprSidecarContainerStatus(pod: V1Pod, name: string): ContainerStatusRepr {
  return reprContainerStatus(pod, name, { kind: "sidecar" });
}

export function reprTimeRelative(time: string): string {
  const now = new Date();
  const date = new Date(time);
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}
