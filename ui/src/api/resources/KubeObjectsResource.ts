import type { KubeSelector, RawKubeObject } from "../../common/types";
import type HttpClient from "../HttpClient";

import BaseResource from "./Base";

export default class KubeObjectsResource extends BaseResource {
  constructor(httpClient: HttpClient) {
    super(httpClient, "/kube/v1/contexts");
  }

  async get(
    ctx: string,
    groupVersion: string,
    resource: string,
    name: string,
    namespace?: string,
  ): Promise<RawKubeObject> {
    if (groupVersion.indexOf("/") === -1) {
      groupVersion = "core/" + groupVersion;
    }
    const url = [ctx, "resources", groupVersion];
    if (namespace) {
      url.push("namespaces", namespace);
    }
    url.push(resource);
    url.push(name);

    return toRawKubeObject(await this.request("GET", `/${url.join("/")}/`));
  }

  async list(
    ctx: string,
    groupVersion: string,
    resource: string,
    selector?: KubeSelector,
  ): Promise<RawKubeObject[]> {
    if (groupVersion.indexOf("/") === -1) {
      groupVersion = "core/" + groupVersion;
    }

    selector = selector || {};

    const query = {
      labelSelector: selector.labels,
      fieldSelector: selector.fields,
    };

    const url = [ctx, "resources", groupVersion];
    if (selector.namespace) {
      url.push("namespaces", selector.namespace);
    }
    url.push(resource);

    if (selector.name) {
      query.fieldSelector = query.fieldSelector || "";
      query.fieldSelector += `metadata.name=${selector.name}`;
    }

    return (await this.request<object[]>("GET", `/${url.join("/")}/`, query)).map(toRawKubeObject);
  }

  async update(
    ctx: string,
    groupVersion: string,
    resource: string,
    name: string,
    manifest: object,
    namespace?: string,
  ): Promise<RawKubeObject> {
    if (groupVersion.indexOf("/") === -1) {
      groupVersion = "core/" + groupVersion;
    }
    const url = [ctx, "resources", groupVersion];
    if (namespace) {
      url.push("namespaces", namespace);
    }
    url.push(resource);
    url.push(name);

    return toRawKubeObject(await this.request("PUT", `/${url.join("/")}/`, undefined, manifest));
  }

  delete(
    ctx: string,
    groupVersion: string,
    resource: string,
    name: string,
    namespace?: string,
  ): Promise<void> {
    if (groupVersion.indexOf("/") === -1) {
      groupVersion = "core/" + groupVersion;
    }
    const url = [ctx, "resources", groupVersion];
    if (namespace) {
      url.push("namespaces", namespace);
    }
    url.push(resource);
    url.push(name);

    return this.request("DELETE", `/${url.join("/")}/`);
  }
}

function toRawKubeObject(json: object): RawKubeObject {
  return json as RawKubeObject;
}
