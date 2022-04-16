class Console {
  constructor(con) {
    this._con = con;
    this._buffer = [];

    Object.keys(con)
      .filter(x => typeof x !== "function")
      .forEach(x => {
        const orig = con[x];
        con[x] = (...args) => {
          this._addToBuffer(x.toUpperCase(), new Date(), ...args);
          orig(...args);
        };
      });
  }

  _addToBuffer(...args) {
    if (this._buffer.length > 500) {
      this._buffer.shift();
    }

    this._buffer.push([...args]);
  }

  get buffer() {
    return this._buffer;
  }
}

export default new Console(console);
