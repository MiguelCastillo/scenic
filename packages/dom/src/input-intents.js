// Input intents are what the player means, whatever device they used: a
// small set of plain events that cameras and menus understand, so that they
// never need to know about keys, the mouse or fingers. Each device has an
// adapter that subscribes to an InputCapture and turns its events into
// intents for the context the player is in, which getContext returns:
// "camera", such as flying around a scene, or "menu".
//
// Camera intents:
// - {type: "look", x, y}: turn, in degrees, x to the right and y up.
// - {type: "zoom", amount}: move closer, in scene units, or farther when
//   negative.
// - {type: "move", forward, right, up}: which way to keep flying, each from
//   -1 to 1, until the next move.
// - {type: "nextCamera"}: switch to the next camera.
//
// Menu intents:
// - {type: "navigate", x, y}: move through the menu, a step at a time, y
//   down and x to the right.
// - {type: "choose", index}: pick an item directly, such as by tapping it,
//   which whatever draws the menu sends, as it knows where its items are.
// - {type: "act", index}: take one of a menu's actions directly, such as a
//   carousel's Race, by tapping it.
// - {type: "select"}: pick the item the menu is on.
// - {type: "back"}: leave the menu.
//
// Each adapter takes {getContext, onIntent}, calls onIntent(intent) for every
// intent, and returns a function that stops it.

// What the keyboard and mouse mean in each context, by KeyboardEvent.code so
// that keys stay in the same place on every keyboard layout. Changing these
// rebinds them.
const keyboardBindings = {
  camera: {
    move: {
      KeyW: {forward: 1},
      KeyS: {forward: -1},
      KeyD: {right: 1},
      KeyA: {right: -1},
      KeyE: {up: 1},
      KeyQ: {up: -1},
    },
    nextCamera: "KeyC",
    lookDegreesPerPixel: 0.1,
    zoomPerPixel: 0.5,
  },
  menu: {
    navigate: {
      ArrowUp: {y: -1},
      ArrowDown: {y: 1},
      ArrowLeft: {x: -1},
      ArrowRight: {x: 1},
      KeyW: {y: -1},
      KeyS: {y: 1},
    },
    select: ["Enter", "Space"],
    back: ["Escape"],
  },
};

// registerKeyboardMouseIntents turns the keyboard and mouse into intents, as
// keyboardBindings says. A computer only plays while the pointer is locked
// to the scene, so camera intents only come while it is, and letting go of
// it stops any flying. Menus get the keyboard without it.
export function registerKeyboardMouseIntents(
  capture,
  {getContext, onIntent, bindings = keyboardBindings}
) {
  // The camera's movement keys held down.
  const heldMoveKeys = new Set();
  const sendMove = () => {
    const move = {forward: 0, right: 0, up: 0};
    for (const code of heldMoveKeys) {
      for (const [direction, amount] of Object.entries(bindings.camera.move[code])) {
        move[direction] += amount;
      }
    }
    onIntent({type: "move", ...move});
  };

  return capture.onInput((event) => {
    if (event.type === "pointerlock" && !event.locked && heldMoveKeys.size) {
      heldMoveKeys.clear();
      sendMove();
      return;
    }

    if (getContext() === "menu") {
      const {navigate, select, back} = bindings.menu;
      if (event.type === "keydown" && !event.repeat) {
        if (navigate[event.code]) {
          onIntent({type: "navigate", x: 0, y: 0, ...navigate[event.code]});
        } else if (select.includes(event.code)) {
          onIntent({type: "select"});
        } else if (back.includes(event.code)) {
          onIntent({type: "back"});
        }
      }
      return;
    }

    const camera = bindings.camera;
    if (event.type === "keyup" && heldMoveKeys.delete(event.code)) {
      sendMove();
    }
    if (!capture.locked) {
      return;
    }
    if (event.type === "keydown" && !event.repeat) {
      if (camera.move[event.code]) {
        heldMoveKeys.add(event.code);
        sendMove();
      } else if (event.code === camera.nextCamera) {
        onIntent({type: "nextCamera"});
      }
    } else if (event.type === "mousemove") {
      onIntent({
        type: "look",
        x: event.x * camera.lookDegreesPerPixel,
        y: -event.y * camera.lookDegreesPerPixel,
      });
    } else if (event.type === "wheel") {
      onIntent({type: "zoom", amount: -event.y * camera.zoomPerPixel});
    }
  });
}

// What touch gestures mean, and how they are told apart.
const touchSettings = {
  lookDegreesPerPixel: 0.2,
  zoomPerPixel: 2,
  // A tap lifts within tapMs of touching, having moved less than tapPixels.
  tapMs: 250,
  tapPixels: 10,
  // A swipe moves at least swipePixels.
  swipePixels: 40,
};

// registerTouchIntents turns touch gestures into intents:
// - Cameras: one finger dragging looks around, two fingers pinching zoom,
//   and tapping with two fingers switches cameras.
// - Menus: swiping moves through the menu, a step for each swipe, and
//   tapping picks the item it is on.
export function registerTouchIntents(capture, {getContext, onIntent, settings = touchSettings}) {
  // The fingers touching, by pointer id: where each is, and where and when
  // it touched down.
  const touchesByID = new Map();
  // The most fingers touching at once in the current gesture, and when it
  // started, to tell a two-finger tap from a one-finger one.
  let gesture = null;

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  return capture.onInput((event) => {
    if (event.kind !== "touch") {
      return;
    }

    if (event.type === "pointerdown") {
      if (!touchesByID.size) {
        gesture = {fingers: 0, startMs: performance.now(), moved: false};
      }
      touchesByID.set(event.id, {x: event.x, y: event.y, startX: event.x, startY: event.y});
      gesture.fingers = Math.max(gesture.fingers, touchesByID.size);
      return;
    }

    const touch = touchesByID.get(event.id);
    if (!touch) {
      return;
    }

    if (event.type === "pointermove") {
      const [a, b] = [...touchesByID.values()];
      const before = b && distance(a, b);
      const dx = event.x - touch.x;
      const dy = event.y - touch.y;
      touch.x = event.x;
      touch.y = event.y;
      if (distance(touch, {x: touch.startX, y: touch.startY}) > settings.tapPixels) {
        gesture.moved = true;
      }

      if (getContext() !== "camera") {
        return;
      }
      if (touchesByID.size === 1) {
        onIntent({
          type: "look",
          x: dx * settings.lookDegreesPerPixel,
          y: -dy * settings.lookDegreesPerPixel,
        });
      } else if (touchesByID.size === 2) {
        const [c, d] = [...touchesByID.values()];
        onIntent({type: "zoom", amount: (distance(c, d) - before) * settings.zoomPerPixel});
      }
      return;
    }

    // The finger lifted.
    touchesByID.delete(event.id);
    if (touchesByID.size) {
      return;
    }
    const tapped = !gesture.moved && performance.now() - gesture.startMs < settings.tapMs;
    const swipe = {x: event.x - touch.startX, y: event.y - touch.startY};

    if (getContext() === "menu") {
      if (tapped && gesture.fingers === 1) {
        onIntent({type: "select"});
      } else if (
        Math.abs(swipe.y) >= settings.swipePixels &&
        Math.abs(swipe.y) > Math.abs(swipe.x)
      ) {
        onIntent({type: "navigate", x: 0, y: Math.sign(swipe.y)});
      } else if (Math.abs(swipe.x) >= settings.swipePixels) {
        onIntent({type: "navigate", x: Math.sign(swipe.x), y: 0});
      }
    } else if (tapped && gesture.fingers === 2) {
      onIntent({type: "nextCamera"});
    }
    gesture = null;
  });
}
