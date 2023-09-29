/* eslint-disable security-node/detect-crlf */
import { v4 as uuidv4 } from "uuid";

import { splitGV } from "../common/kubeutil";
import type { KubeContext, KubeResource, KubeSelector, RawKubeObject } from "../common/types";

interface Handler {
  resolve: (response: { json?: string, yaml?: string, event: string }) => void;
  reject: (error: Error) => void;
}

export default class Stream {
  constructor(
    private wsServer: string,
    private socket: WebSocket | null = null,
    private handlers: Record<string, Handler>,
  ) {
    this.wsServer = wsServer;// .replace(/\/*\s*$/, '');
    this.socket = null;
    this.handlers = {};
  }

  connect(): Promise<void> {
    if (this.socket) {
      throw new Error("Stream has already been connected before");
    }

    return new Promise((resolve, reject) => {
      let connecting = true;

      this.socket = new WebSocket(this.wsServer);

      this.socket.addEventListener("open", () => {
        connecting = false;
        resolve();
      });

      this.socket.addEventListener("close", (event) => {
        console.log("Stream has been closed", event);
      });

      this.socket.addEventListener("error", (event) => {
        console.error("Stream error", event);

        if (connecting) {
          connecting = false;
          reject(event);
        }
      });

      this.socket.addEventListener("message", (event) => {
        let reply;
        try {
          reply = JSON.parse(event.data);
        } catch (e) {
          console.error("Malformed stream message");
          return;
        }

        const handler = this.handlers[reply.id];
        if (!handler) {
          console.error("Unregistered message ID", reply);
          return;
        }
        delete this.handlers[reply.id];

        if (reply.error) {
          handler.reject(reply.error);
        } else {
          handler.resolve(reply.result);
        }
      });
    });
  }

  watchKubeObjects(
    kubeContext: KubeContext,
    kubeResource: KubeResource,
    selector: KubeSelector,
    callback: (error: Error | null, object: RawKubeObject | null, event: { [event: string]: boolean }) => void,
  ) {
    if (!this.socket) {
      throw new Error("Stream has not been connected yet");
    }

    const [group, version] = splitGV(kubeResource.groupVersion);
    const callId = this._callId();
    const handler: Handler = {
      resolve: (response) => {
        if (!response.json) {
          callback(new Error("No manifest (JSON) in response"), null, {});
          return;
        }

        try {
          const obj = JSON.parse(response.json) as RawKubeObject;
          callback(null, obj, { [response.event]: true }); // _added, _updated, _deleted
        } catch (e) {
          callback(new Error(`Failed to parse Kubernetes manifest (JSON): ${e}`), null, {});
        } finally {
          this.handlers[callId] = handler;
        }
      },
      reject: (err) => {
        callback(err, null, {});
      },
    };

    this.handlers[callId] = handler;

    this.socket.send(JSON.stringify({
      type: "call",
      id: callId,
      method: "kubeObjects.watch",
      params: {
        context: kubeContext.name,
        group: group || "core",
        version,
        resource: kubeResource.name,
        namespace: selector.namespace,
        name: selector.name,
        fieldSelector: selector.fields,
        labelSelector: selector.labels,
      },
    }));

    return callId;
  }

  unwatchKubeObjects(watchId: string) {
    if (!this.socket) {
      throw new Error("Stream has not been connected yet");
    }

    this.handlers[watchId] = {
      resolve: (resp) => console.debug("Unwatched", watchId, resp),
      reject: (err) => console.error("Unwatch failed", watchId, err),
    };

    this.socket.send(JSON.stringify({
      type: "call",
      id: watchId,
      method: ".cancel",
    }));
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return;
      }

      this.socket.addEventListener("close", resolve);
      this.socket.addEventListener("error", reject);
      this.socket.close();
    });
  }

  _callId() {
    return uuidv4().split("-")[0];
  }
}
