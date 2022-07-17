// Import DOMEvents to shim the DOM event API.
import "./events.js";

var _onReadyDeferred = new Promise(function (resolve) {
  if (document.readyState === "complete") {
    resolve();
  } else {
    document.addEventListener("DOMContentLoaded", (/*evt*/) => resolve());
  }
});

export function onReady(fn) {
  _onReadyDeferred.then(fn);
}
