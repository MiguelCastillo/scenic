// EventBus carries events from publishers to whoever reads them, a frame at
// a time: publishers publish plain data on named channels, and every event
// of the frame is kept, in order, such as each key going down and up.
//
// beginFrame starts a frame's events, and flush sends them: every listener
// gets the frame's events as {channel: [event, ...]}, in the order the
// channels were first published that frame. Flushing again before the next
// beginFrame sends the same frame's events again, with anything published
// since. take returns the frame's events the same way and starts the next
// frame, for whoever reads them itself rather than listening, such as a
// SceneRunner reading the player's input.
//
// Its API: publish(channel, event), onUpdate(cb), which calls cb(events)
// when the frame is flushed and returns a function that stops it,
// beginFrame(), flush() and take().
export class EventBus {
  constructor() {
    this._listeners = new Set();
    this._messages = new Map();
  }

  publish(channel, event) {
    this._messages.set(channel, [...(this._messages.get(channel) ?? []), event]);
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

  take() {
    const messages = Object.fromEntries(this._messages);
    this.beginFrame();
    return messages;
  }
}

// BufferedEventBus is an EventBus that keeps only the last message published
// on each channel each frame, for messages that each say all there is to
// know, such as what a HUD shows. A publisher that publishes often, such as
// every time a scene draws, is heard once a frame: listeners get
// {channel: message}. A channel that stops publishing is missing from the
// next frame's messages.
export class BufferedEventBus extends EventBus {
  publish(channel, message) {
    this._messages.set(channel, message);
  }
}
