import BaseResource from "./Base";

export default class KubeResourcesResource extends BaseResource {
  constructor(httpClient) {
    super(httpClient, "/kube/v1/contexts");
  }

  list(ctx) {
    return this.request("GET", `/${ctx}/resources/`);
  }
}
