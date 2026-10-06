import { reportClientCrash } from "./lib/crash-reporting";

window.addEventListener("error", (event) => {
  if (event.error) reportClientCrash(event.error);
});
window.addEventListener("unhandledrejection", (event) => reportClientCrash(event.reason));
