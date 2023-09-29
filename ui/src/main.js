import "./main.css";

import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";

import BiXdm from "./api/BiXdm";
import HttpClient from "./api/HttpClient";
import Stream from "./api/Stream";
import KubeContextsResource from "./api/resources/KubeContextsResource";
import KubeObjectsResource from "./api/resources/KubeObjectsResource";
import KubeResourcesResource from "./api/resources/KubeResourcesResource";

const host = `${window.location.host}`;
const protocol = `${window.location.protocol}`;
const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
const httpClient = new HttpClient(`${protocol}//${host}/api/`);

createApp(App)
  .use(createPinia()
    .use(() => ({
      biXdm: new BiXdm(),
      resKubeContexts: new KubeContextsResource(httpClient),
      resKubeObjects: new KubeObjectsResource(httpClient),
      resKubeResources: new KubeResourcesResource(httpClient),
      streamProvider: () => new Stream(`${wsProtocol}//${host}/api/stream/v1/`),
    })),
  ).mount("#app");
