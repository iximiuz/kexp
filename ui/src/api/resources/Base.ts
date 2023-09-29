import type HttpClient from "../HttpClient";

export default class BaseResource {
  constructor(private httpClient: HttpClient, private urlPrefix: string) {
    this.httpClient = httpClient;
    this.urlPrefix = urlPrefix;
  }

  async request<T>(method: string, url: string, query?: object, data?: object): Promise<T> {
    const resp = await this.httpClient.request(
      method,
      this.urlPrefix + url,
      query,
      data,
    );
    return resp.data;
  }
}
