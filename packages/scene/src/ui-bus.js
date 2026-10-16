// UiBus carries messages from a scene to the app's UI, such as a race's lap
// and time for its HUD. Nodes and scripts publish what they know as plain
// data on a channel, and the app, which knows what each channel's messages
// hold, shows them however it likes. It is how a scene talks to the page
// without knowing anything about it.
//
// A node publishes on the channel named by "hud" in its own state, such as
// {"hud": "race"}, and publishes nothing without one. Messages are output,
// worked out from the scene's state, so publishing never changes the scene,
// and it can happen while drawing.
//
// Messages are kept for the frame rather than sent as they come, so a scene
// that publishes often, such as every time it draws, tells the app once a
// frame. SceneManager starts each frame's messages when it updates the scene
// (beginFrame), and sends them when it has drawn it (flush): every listener
// gets the frame's messages, the last on each channel, as {channel: message},
// in the order the channels were first published that frame. A channel that
// stops publishing is missing from the next frame's messages, so the app can
// stop showing it. Drawing again without an update sends the same frame's
// messages again, with anything published while drawing up to date.
//
// Its API: publish(channel, message), onUpdate(cb), which calls cb(messages)
// once a frame and returns a function that stops it, and beginFrame() and
// flush(), which SceneManager calls.
export class UiBus {
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
