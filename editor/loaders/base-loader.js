/**
 * API for loading different file types in a web worker.
 */

export class BaseLoader {
  constructor(worker) {
    this.worker = worker;

    this.worker.onmessage = (evt) => {
      const {file, model} = evt.data;
      this.pending[file].resolve(model);
      delete this.pending[file];
    };

    this.pending = {};
  }

  load(file, options={}) {
    return new Promise((resolve, reject) => {
      this.pending[file] = {resolve, reject};
      this.worker.postMessage({file, ...options});
    });
  }
}
