// createKeyManager keeps track of the keyboard events and returns the list of
// currently pressed keys. This allows us to process multiple key down events
// simultaneously in the eventLoop.
export function createKeyManager() {
  const keys = {};

  Subscription.create(window)
    .on("keyup", (evt) => {
      delete keys[evt.code];
    })
    .on("keydown", (evt) => {
      keys[evt.code] = true;
    });

  function getKeyState() {
    return keys;
  }

  return {
    getKeyState,
  };
}
