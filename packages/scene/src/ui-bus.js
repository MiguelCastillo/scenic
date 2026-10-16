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
// Its API: publish(channel, message), and onUpdate(cb), which calls
// cb(channel, message) for every message published after it and returns a
// function that stops it.
export class UiBus {
  constructor() {
    this._listeners = new Set();
  }

  publish(channel, message) {
    this._listeners.forEach((cb) => cb(channel, message));
  }

  onUpdate(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
}
