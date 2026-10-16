// EventBus carries messages from publishers to listeners, a frame at a
// time: publishers publish plain data on named channels, and every listener
// hears the frame's messages together, once the frame is done.
//
// Messages are kept for the frame rather than sent as they come, so a
// publisher that publishes often, such as every time a scene draws, is heard
// once a frame. beginFrame starts a frame's messages, and flush sends them:
// every listener gets the frame's messages, the last on each channel, as
// {channel: message}, in the order the channels were first published that
// frame. A channel that stops publishing is missing from the next frame's
// messages. Flushing again before the next beginFrame sends the same frame's
// messages again, with anything published since up to date.
//
// Its API: publish(channel, message), onUpdate(cb), which calls cb(messages)
// once a frame and returns a function that stops it, beginFrame() and
// flush().
export class EventBus {
  constructor() {
    this._listeners = new Set();
    this._messages = new Map();
  }

  publish(channel, message) {
    this._messages.set(channel, message);
  }

  onUpdate(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  beginFrame() {
    this._messages.clear();
  }

  flush() {
    const messages = Object.fromEntries(this._messages);
    this._listeners.forEach((cb) => cb(messages));
  }
}
