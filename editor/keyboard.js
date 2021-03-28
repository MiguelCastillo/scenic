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
    getKeyState
  };
}

function createRotationManager() {
  return function updateRotation(keys) {
    const rotation = [0, 0, 0];

    Object.keys(keys).forEach(code => {
      if (code === "ArrowUp") {
        rotation[0] -= 1;
      } else if (code === "ArrowDown") {
        rotation[0] += 1;
      } else if (code === "ArrowRight") {
        if (keys["AltLeft"]) {
          rotation[2] -= 1;
        }
        else {
          rotation[1] += 1;
        }
      } else if (code === "ArrowLeft") {
        if (keys["AltLeft"]) {
          rotation[2] += 1;
        }
        else {
          rotation[1] -= 1;
        }
      }  
    });

    return rotation;
  }
}
