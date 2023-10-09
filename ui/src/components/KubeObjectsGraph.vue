<!-- eslint-disable import/first -->
<script>
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import nodeHtmlLabel from "cytoscape-node-html-label";

nodeHtmlLabel(cytoscape);
cytoscape.use(dagre);
</script>

<!-- eslint-disable import/first -->
<script setup>
import { onMounted, ref, watchEffect } from "vue";

import { splitGVK } from "../common/kubeutil";
import { objectRelations } from "../common/relations";
import {
  podPhaseClass,
  reprContainerStatus,
  reprInitContainerStatus,
  reprPodPhase,
  reprSidecarContainerStatus,
} from "../common/repr";
import { useAppStore } from "../stores";

const weights = {
  Service: 500,
  ServiceAccount: 500,
  Pod: 1000,
  ReplicaSet: 2000,
  DaemonSet: 3000,
  Deployment: 3000,
  StatefulSet: 3000,
};

const layout = {
  name: "dagre",
  // rankDir: "TB",
  // align: "UR",
  // spacingFactor: 1.1,
  ranker: "longest-path", // "tight-tree", "network-simplex"
  animate: true,
  animationDuration: 500,
  fit: true,
  sort: (a, b) => {
    const objectA = a.data("object");
    const objectB = b.data("object");
    if (!objectA || !objectB) {
      return 0;
    }

    const v = (weights[objectA.gvk.kind] || 0) - (weights[objectB.gvk.kind] || 0);
    return v === 0 ? 0 : v > 0 ? 1 : -1;
  },
};

function newNode(obj) {
  return {
    data: {
      id: obj.ident,
      object: obj,
    },
  };
}

const EDGE_KIND_OWNERSHIP = "ownership";
const EDGE_KIND_RELATION = "relation";

function newEdge(orig, dest, kind) {
  return {
    data: {
      id: orig.data.id + "/" + dest.data.id,
      source: orig.data.id,
      target: dest.data.id,
      kind,
    },
  };
}

const nodes = {};
const edges = {};

const cyGraphCont = ref(null);

let cyGraph = null;

const _objectEdges = (obj) => {
  const objEdges = {};

  const relations = objectRelations(obj);

  for (const node of Object.values(nodes)) {
    const other = node.data.object;

    if (other.isOwnedBy(obj)) {
      const edge = newEdge(nodes[obj.ident], node, EDGE_KIND_OWNERSHIP);
      objEdges[edge.data.id] = edge;
      continue;
    }

    if (other.isOwner(obj)) {
      const edge = newEdge(node, nodes[obj.ident], EDGE_KIND_OWNERSHIP);
      objEdges[edge.data.id] = edge;
      continue;
    }

    const [gv, kind] = splitGVK(other.gvk.toString());
    if (!relations[gv] || !relations[gv][kind]) {
      continue;
    }
    if (relations[gv][kind].via) {
      continue;
    }

    if (relations[gv][kind](obj, other)) {
      const edge = newEdge(nodes[obj.ident], node, EDGE_KIND_RELATION);
      objEdges[edge.data.id] = edge;
    }
  }

  return objEdges;
};

const upsertObject = (obj) => {
  if (nodes[obj.ident]) {
    const el = cyGraph.$id(obj.ident);
    if (!el) {
      console.warn("Cannot find graph node for object", obj);
      return;
    }
    if (!el.data()) {
      console.warn("Found graph node WITHOUT data element", el, obj);
      return;
    }
    if (el.data().object.rev === obj.rev) {
      // Noop
      return;
    }

    el.data({ object: obj });

    const objEdges = _objectEdges(obj);
    for (const id in objEdges) {
      if (!edges[id]) {
        edges[id] = objEdges[id];
        cyGraph.add(edges[id]).addClass(edges[id].data.kind);
      }
    }
    for (const id in edges) {
      const edge = edges[id];
      if ((edge.data.source === obj.ident || edge.data.target === obj.ident) && !objEdges[id]) {
        cyGraph.$id(id).remove();
        delete edges[id];
      }
    }
  } else {
    nodes[obj.ident] = newNode(obj);
    cyGraph.add(nodes[obj.ident]);

    _styleNode(obj);
    watchEffect(() => _styleNode(obj));

    cyGraph.$id(obj.ident).on("tap", (event) => {
      event.stopPropagation();

      useAppStore().setInspectedKubeObject(event.target.data().object);
    });

    const objEdges = _objectEdges(obj);
    for (const id in objEdges) {
      if (!edges[id]) {
        edges[id] = objEdges[id];
        cyGraph.add(edges[id]).addClass(edges[id].data.kind);
      }
    }

    _relayout();
  }
};

const removeObject = (obj) => {
  if (!nodes[obj.ident]) {
    return;
  }

  for (const id in edges) {
    if (edges[id].data.target === obj.ident || edges[id].data.source === obj.ident) {
      delete edges[id];
      cyGraph.$id(id).remove();
    }
  }

  const el = cyGraph.$id(obj.ident);
  if (el) {
    el.remove();
  }

  delete nodes[obj.ident];

  _fit();
};

const highlightGroup = (objects) => {
  if (objects.length === 0) {
    cyGraph.nodes().removeClass("dimmed");
    return;
  }

  cyGraph.nodes().addClass("dimmed");
  for (const obj of objects) {
    const el = cyGraph.$id(obj.ident);
    if (el) {
      el.removeClass("dimmed");
    }
  }
};

defineExpose({
  currentObjects: () => Object.values(nodes).map((n) => n.data.object),
  hasObject: (obj) => !!nodes[obj.ident],
  upsertObject,
  removeObject,
  highlightGroup,
});

onMounted(() => {
  cyGraph = cytoscape({
    container: cyGraphCont.value,
    elements: [
      ...Object.values(nodes),
      ...Object.values(edges),
    ],
    style: [
      {
        selector: "node",
        style: {
          // label: "data(id)",
          shape: "round-rectangle",
          // "background-color": "rgb(68, 173, 238)",
          "background-color": "rgb(36, 158, 235)",
          width: "200px",
          height: "80px",
          padding: "5px",
          "border-width": 2,
          // "border-color": "rgb(68, 173, 238)",
          "border-color": "rgb(36, 158, 235)",
        },
      },
      {
        selector: "node.created",
        style: {
          "background-color": "rgb(21, 128, 61)",
        },
      },
      {
        selector: "node.updated",
        style: {
          "background-color": "rgb(245, 158, 11)",
        },
      },
      {
        selector: "node.deleted",
        style: {
          "background-color": "rgb(239, 68, 68)",
        },
      },
      {
        selector: "node.focused",
        style: {
          "border-width": 2,
          "border-color": "black",
        },
      },
      {
        selector: "node.dimmed",
        style: {
          opacity: "0.5",
        },
      },
      {
        selector: "node:selected",
        style: {
          "border-width": 2,
          "border-color": "blue",
        },
      },
      {
        selector: "node.resource-pod",
        style: {
          shape: "round-octagon",
          width: "200px",
          height: "80px",
        },
      },
      {
        selector: "edge.relation",
        style: {
          width: 3,
          "line-color": "#ccc",
          "line-style": "dashed",
          "curve-style": "bezier",
        },
      },
      {
        selector: "edge.ownership",
        style: {
          width: 3,
          "line-color": "rgb(132, 204, 22)",
          "line-style": "solid",
          "curve-style": "bezier",
        },
      },
    ],
    layout,
  });

  cyGraph.nodeHtmlLabel([
    {
      query: "node",
      valign: "top",
      halign: "left",
      valignBox: "bottom",
      halignBox: "right",
      tpl: (data) => {
        if (!data.object) {
          return "";
        }

        const label = [
          "<div class=\"node-label\">",
          `<span class="node-label-kind flex items-center justify-center">${data.object.gvk.kind}`,
        ];

        if (data.object.gvk.toString() === "v1/Pod") {
          const phase = reprPodPhase(data.object.raw);
          label.push(`<div title="${phase.title}" class="border ml-2 border-black h-[0.7rem] rounded-full w-[0.7rem] bg-${podPhaseClass[phase.phase]}"></div>`);
        } else if (data.object.gvk.toString() === "v1/Node") {
          // TODO: Move this logic to reprNodeStatus.
          const ready = data.object.raw.status
            ? data.object.raw.status.conditions.find((c) => c.type === "Ready")
            : { status: "Unknown" };
          const readyClass = ready.status === "True"
            ? "bg-status-ready"
            : ready.status === "False"
              ? "bg-status-not-ready"
              : "bg-status-unknown";

          label.push(`<div title="Ready: ${ready.status}" class="border ml-2 border-black h-[0.7rem] rounded-full w-[0.7rem] ${readyClass}"></div>`);
        }

        label.push("</span>");
        label.push(`<p class="node-label-title">${data.object.name}</p>`);

        if (data.object.gvk.toString() === "v1/Pod") {
          label.push(..._podLabel(data.object));
        } else {
          let subtitle = data.object.deletedAt
            ? "deleted"
            : "ver=" + data.object.raw.metadata.resourceVersion;
          subtitle += " uid=" + data.object.raw.metadata.uid.substring(0, 4) + "..." + data.object.raw.metadata.uid.substr(-4);
          label.push(`<p class="node-label-subtitle">${subtitle}</p>`);
        }

        label.push("</div>");
        return label.join("");
      },
    },
  ]);

  function _podLabel(pod) {
    const label = ["<div class=\"node-label-containers\">"];

    for (const c of pod.raw.spec.initContainers || []) {
      const s = c.restartPolicy === "Always"
        ? reprSidecarContainerStatus(pod.raw, c.name)
        : reprInitContainerStatus(pod.raw, c.name);
      const t = `${c.name} + (init): ${s.title}`;
      label.push(`<div class="node-label-container container-${s.status}" title="${t}">${c.name[0]}</div>`);
    }

    for (const c of pod.raw.spec.containers || []) {
      const s = reprContainerStatus(pod.raw, c.name);
      const t = `${c.name}: ${s.title}`;
      label.push(`<div class="node-label-container container-${s.status}" title="${t}">${c.name[0]}</div>`);
    }

    label.push("</div>");
    return label;
  }

  cyGraph.on("tap", (event) => {
    event.stopPropagation();

    useAppStore().setInspectedKubeObject(null);
  });

  cyGraph.on("resize", _fit);
  _fit();
});

const _styleNode = (obj) => {
  const el = cyGraph.$id(obj.ident);

  if (obj.evicted) {
    el.remove();
    return;
  }

  el.addClass("resource-" + obj.resource.kind.toLowerCase());

  if (obj.isFreshlyCreated) {
    el.addClass("created");
  } else {
    el.removeClass("created");
  }

  if (obj.isFreshlyUpdated) {
    el.addClass("updated");
  } else {
    el.removeClass("updated");
  }

  if (obj.deletedAt || obj.raw.metadata.deletionTimestamp) {
    el.addClass("deleted");
  } else {
    el.removeClass("deleted");
  }

  if (obj.focused) {
    el.addClass("focused");
  } else {
    el.removeClass("focused");
  }
};

let layoutTimer = null;

function _relayout() {
  if (layoutTimer) {
    clearTimeout(layoutTimer);
  }
  layoutTimer = setTimeout(() => {
    cyGraph.layout({
      ...layout,
      fit: true,
      padding: _padding(),
    }).run();
    layoutTimer = null;
  }, 50);
}

function _fit() {
  cyGraph.fit([], Math.max(50, _padding()));
}

function _padding() {
  if (!cyGraphCont.value) {
    return 0;
  }

  const nodesCount = Object.keys(nodes).length;
  const padding = Math.min(
    cyGraphCont.value.offsetWidth - 200 * nodesCount,
    cyGraphCont.value.offsetHeight - 100 * nodesCount,
  ) / 2;

  return Math.max(50, padding);
}
</script>

<template>
  <div
    ref="cyGraphCont"
    class="cursor-grab h-full min-w-[300px]"
  />
</template>

<style>
.node-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-width: 200px;
  min-width: 0px;
  width: 200px;
  height: 80px;
  overflow: hidden;
  padding: 0px 5px;
}

.node-label p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.node-label-kind {
  font-weight: 700;
  font-size: 14px;
}

.node-label-title {
  font-weight: 500;
  font-size: 14px;
}

.node-label-subtitle {
  font-size: 10px;
}

.node-label-containers {
  display: flex;
  margin-top: 5px;
  border: 1px solid #fff;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
}

.node-label-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 14px;
  height: 14px;
  color: #fff;
  font-weight: 700;
  font-size: 8px;
  text-transform: uppercase;
}

.node-label-container:not(:last-child) {
  border-right: 1px solid #fff;
  widows: 15px;
}
</style>
