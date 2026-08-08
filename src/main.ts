import { appVersion } from "./version.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = `Quick Versus — v${appVersion}`;
}
