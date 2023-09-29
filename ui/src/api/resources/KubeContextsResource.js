import BaseResource from "./Base";

export default class KubeContextsResource extends BaseResource {
  constructor(httpClient) {
    super(httpClient, "/kube/v1/contexts");
  }

  list() {
    return this.request("GET", "/");
  }
}
