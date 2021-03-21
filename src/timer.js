export class Timer {
  start = () => {
    this._start = Date.now();
  }

  elapsed = () => {
    return (Date.now() - this._start)/1000;
  }
}
