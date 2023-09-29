import axios from "axios";
import axiosRetry from "axios-retry";

// eslint-disable-next-line import/no-named-as-default-member
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export default class HttpClient {
  constructor(private apiServer: string) {
    this.apiServer = apiServer.replace(/\/*\s*$/, "");
  }

  async request(method: string, path: string, params?: object, data?: object) {
    // await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
    // if (Math.random() < 0.05) {
    //   throw new Error("Ooops");
    // }

    console.assert(path[0] === "/", "API request path must start with /. Got", path);

    return await axios({
      method,
      url: this.apiServer + path,
      params,
      data,
    });
  }
}
