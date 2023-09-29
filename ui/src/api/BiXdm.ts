interface Call {
  callId: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export default class BiXdm {
  constructor(
    private calls: Map<string, Call>,
    private handlers: Map<string, (params: object) => Promise<any>>,
  ) {
    this.calls = new Map();
    this.handlers = new Map();
  }

  init() {
    window.addEventListener("message", (event) => this._onMessage(event));
    window.parent.postMessage({ kind: "rpc.init" }, "*");
  }

  destroy() {
    // TODO: window.removeEventListener("message", this._onMessage);
  }

  addHandler<T>(method: string, handler: (params: object) => Promise<T>) {
    this.handlers.set(method, handler);
  }

  call<T>(method: string, params: object): Promise<T> {
    const call = {
      // eslint-disable-next-line security-node/detect-insecure-randomness
      callId: Math.random().toString(36).substring(7),
      method,
      params,
    };

    // eslint-disable-next-line promise/param-names
    const promise = new Promise<T>((resolve, reject) => {
      this.calls.set(call.callId, { callId: call.callId, resolve, reject });
    });

    window.parent.postMessage({ kind: "rpc.request", ...call }, "*");

    return promise;
  }

  async _onMessage(event: MessageEvent) {
    if (event.data.kind === "rpc.response") {
      const call = this.calls.get(event.data.callId);
      if (call) {
        this.calls.delete(event.data.callId);
        if (event.data.error) {
          call.reject(event.data.error);
        } else {
          call.resolve(event.data.result);
        }
      }
      return;
    }

    if (event.data.kind === "rpc.request") {
      const handler = this.handlers.get(event.data.method);
      if (handler) {
        try {
          const result = await handler(event.data.params);
          window.parent.postMessage({ kind: "rpc.response", callId: event.data.callId, result }, "*");
        } catch (error) {
          window.parent.postMessage({ kind: "rpc.response", callId: event.data.callId, error }, "*");
        }
      }
    }
  }
}
