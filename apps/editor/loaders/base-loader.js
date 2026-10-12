/**
 * API for loading different file types in a web worker.
 */

import {timer} from "@scenic/utils";

export class BaseLoader {
  load() {
    throw new Error("Must implement load");
  }

  // dispose releases whatever the loader holds on to. Loaders that only
  // fetch hold nothing, so this is a no-op unless overridden.
  dispose() {}
}

export class TextFileLoader extends BaseLoader {
  load(file) {
    const t = new timer.Timer();
    return fetch(file).then((res) => {
      // eslint-disable-next-line no-console
      console.log("Downloaded:", file, `${t.elapsed()} seconds`);
      return res.text();
    });
  }
}

export class BrinaryFileLoader extends BaseLoader {
  load(file) {
    const t = new timer.Timer();
    return fetch(file).then((res) => {
      // eslint-disable-next-line no-console
      console.log("Downloaded:", file, `${t.elapsed()} seconds`);
      return res.arrayBuffer();
    });
  }
}

export class WorkerLoader extends BaseLoader {
  constructor(worker) {
    super();
    this.worker = worker;

    this.worker.onmessage = (evt) => {
      const {file, model} = evt.data;
      this.pending[file].resolve(model);
      delete this.pending[file];
    };

    this.pending = {};
  }

  load(file, options = {}) {
    return new Promise((resolve, reject) => {
      this.pending[file] = {resolve, reject};
      this.worker.postMessage({file, ...options});
    });
  }

  // Loads still pending when the worker is terminated never settle.
  dispose() {
    this.worker.terminate();
  }
}
