import {events as domEvents} from "@scenic/dom";

// How far the camera turns, in degrees, per pixel of mouse movement, and how
// far it flies, in scene units, per pixel of wheel or trackpad scrolling.
const cameraTurnDegreesPerPixel = 0.1;
const cameraScrollDistancePerPixel = 0.5;

// Keys that fly the camera while they are held, by KeyboardEvent.code so that
// they stay in the same place on every keyboard layout. Only cameras that fly,
// such as a free camera, move with them.
const cameraMovementKeys = {
  KeyW: {forward: 1},
  KeyS: {forward: -1},
  KeyD: {right: 1},
  KeyA: {right: -1},
  KeyE: {up: 1},
  KeyQ: {up: -1},
};

// The key that switches to the next camera, such as from following a ship to
// its cockpit.
const nextCameraKey = "KeyC";

// The key that pauses and resumes the game.
const pauseKey = "KeyP";

// Keys that scroll the page, which games use instead, such as to fly a ship.
const pageScrollKeys = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// subscribeToSceneInput maps the mouse and keyboard onto a scene through
// its runner (see SceneRunner), the same way the editor does (see
// apps/editor/app-main.jsx): the active camera responds as its type says (see
// CameraSystem in @scenic/camera), and every key held down and how far the
// mouse moves go to the scene's scripts, such as a ship's flight controls.
// Clicking the canvas locks the pointer to it, and Escape lets it go.
//
// The game only plays while the pointer is locked: it starts paused, since
// scenes load paused, clicking resumes it, and letting go of the pointer
// pauses it again, so the race clock doesn't run while the player isn't
// playing. P pauses and resumes it while playing. onChange is called with
// {locked, paused} whenever either changes, so the page can tell the player
// what to do.
export function subscribeToSceneInput(canvas, runner, onChange) {
  const isPointerLocked = () => document.pointerLockElement === canvas;
  const heldKeys = new Set();
  const scriptKeys = new Set();

  // Whether the game is paused for want of the pointer, rather than by P, so
  // that locking it resumes the game but doesn't undo P. It is, to start.
  let pausedByUnlock = runner.isPaused();
  const notify = () => onChange({locked: isPointerLocked(), paused: runner.isPaused()});
  notify();

  function updateCameraMovement() {
    const movement = {forward: 0, right: 0, up: 0};
    for (const code of heldKeys) {
      for (const [direction, amount] of Object.entries(cameraMovementKeys[code])) {
        movement[direction] += amount;
      }
    }
    runner.cameras?.setMovement(movement);
  }

  domEvents.Subscription.create(canvas)
    .on("click", () => {
      canvas.requestPointerLock();
    })
    .on("mousemove", (evt) => {
      if (isPointerLocked()) {
        // While paused the mouse looks around, even with cameras that leave
        // it to the scene.
        const right = evt.movementX * cameraTurnDegreesPerPixel;
        const up = -evt.movementY * cameraTurnDegreesPerPixel;
        if (runner.isPaused()) {
          runner.cameras?.lookAround(right, up);
        } else {
          runner.cameras?.turn(right, up);
        }
        runner.addMouseMovement(evt.movementX, evt.movementY);
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();
      if (isPointerLocked()) {
        runner.cameras?.move(
          -evt.deltaY * cameraScrollDistancePerPixel,
          evt.deltaX * cameraScrollDistancePerPixel,
          0
        );
      }
    });

  domEvents.Subscription.create(document)
    .on("keydown", (evt) => {
      if (!isPointerLocked()) {
        return;
      }

      if (!scriptKeys.has(evt.code)) {
        scriptKeys.add(evt.code);
        runner.setHeldKeys(scriptKeys);
      }
      if (pageScrollKeys.has(evt.code)) {
        evt.preventDefault();
      }

      if (evt.code === pauseKey && !evt.repeat) {
        evt.preventDefault();
        runner.togglePause();
        pausedByUnlock = false;
        notify();
        return;
      }

      if (evt.code === nextCameraKey && !evt.repeat) {
        evt.preventDefault();
        runner.cameras?.nextCamera();
        // Held movement belongs to each camera, so tell the new one about
        // keys that are still down.
        updateCameraMovement();
        return;
      }

      if (cameraMovementKeys[evt.code]) {
        evt.preventDefault();
        heldKeys.add(evt.code);
        updateCameraMovement();
      }
    })
    .on("keyup", (evt) => {
      if (scriptKeys.delete(evt.code)) {
        runner.setHeldKeys(scriptKeys);
      }
      if (heldKeys.delete(evt.code)) {
        updateCameraMovement();
      }
    })
    .on("pointerlockchange", () => {
      if (isPointerLocked()) {
        if (pausedByUnlock) {
          runner.togglePause();
          pausedByUnlock = false;
        }
      } else {
        // Keys released while the pointer was unlocked never send keyup
        // here, so everything is treated as released when the lock is lost.
        heldKeys.clear();
        updateCameraMovement();
        scriptKeys.clear();
        runner.setHeldKeys(scriptKeys);
        if (!runner.isPaused()) {
          runner.togglePause();
          pausedByUnlock = true;
        }
      }
      notify();
    });
}
