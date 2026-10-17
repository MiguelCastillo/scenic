// The arcade's input comes from an InputCapture (see @scenic/dom), and these
// subscribers to it each do one job with it. Both take getRunners, which
// returns the scenes' runners, bottom first, such as a SceneStack's (see
// SceneRunner in @scenic/runtime), and ask it every time, so the arcade can
// stack a menu over the game or load another track. Of those, the game is the
// top scene with cameras the player moves, such as a race under its menu.

// The key that pauses and resumes the game.
const pauseKey = "KeyP";

// registerSceneInputRouting gives what capture catches to the scenes, as
// their player's input, on the "player" channel of each one's
// sceneManager.input (see SceneManager in @scenic/scene), which moves its
// cameras and its scripts:
// - The keyboard goes to the top scene, such as a menu over the game. The
//   game gets it only while the pointer is locked to it, and a scene without
//   cameras, such as a menu, gets it without.
// - The mouse and the wheel go to the game while the pointer is locked.
// A key goes up in the scene it went down in, and the game's keys go up when
// the pointer is let go, since their keyups never come. It returns a function
// that stops the routing.
export function registerSceneInputRouting(capture, getRunners) {
  // The keys held down, with the runner each went down in.
  const runnersByHeldKey = new Map();
  const publish = (runner, event) => runner.sceneManager.input.publish("player", event);

  return capture.onInput((event) => {
    const runners = getRunners();
    const focused = runners.at(-1);
    const game = runners.findLast((runner) => runner.cameras);
    const gameHasPointer = capture.locked && focused === game;

    switch (event.type) {
      case "keydown":
        if (focused && (gameHasPointer || !focused.cameras) && !runnersByHeldKey.has(event.code)) {
          runnersByHeldKey.set(event.code, focused);
          publish(focused, {type: "keydown", code: event.code});
        }
        break;
      case "keyup":
        if (runnersByHeldKey.has(event.code)) {
          publish(runnersByHeldKey.get(event.code), {type: "keyup", code: event.code});
          runnersByHeldKey.delete(event.code);
        }
        break;
      case "mousemove":
      case "wheel":
        if (gameHasPointer) {
          publish(game, {type: event.type, x: event.x, y: event.y});
        }
        break;
      case "pointerlock":
        if (!event.locked) {
          for (const [code, runner] of runnersByHeldKey) {
            if (runner === game) {
              publish(runner, {type: "keyup", code});
              runnersByHeldKey.delete(code);
            }
          }
        }
        break;
    }
  });
}

// PlayWhileLocked plays the game only while the pointer is locked to it: it
// starts paused, since scenes load paused, clicking the canvas while the
// game is on top locks the pointer and resumes it, and letting go of the
// pointer, such as with Escape or by opening a menu, pauses it again, so the
// race clock doesn't run while the player isn't playing. P pauses and
// resumes it while playing. onChange is called with {locked, paused}
// whenever either changes, so the page can tell the player what to do.
//
// Its API: play(), which locks the pointer, and so resumes the game, such as
// when the player picks Resume in a menu, and reset(), to call when the
// scenes change, such as another track replacing the game, which starts
// paused until the player clicks.
export class PlayWhileLocked {
  constructor(capture, getRunners, onChange) {
    this._capture = capture;
    this._getGame = () => getRunners().findLast((runner) => runner.cameras);
    this._onChange = onChange;

    // Whether the game is paused for want of the pointer, rather than by P,
    // so that locking it resumes the game but doesn't undo P.
    this._pausedByUnlock = false;
    this.reset();

    capture.onInput((event) => {
      const game = this._getGame();
      const focused = getRunners().at(-1);
      if (!game) {
        return;
      }

      // Touches tap to play instead (see PlayOnTap), and tablets have no
      // pointer to lock.
      if (event.type === "click" && event.kind !== "touch" && focused === game) {
        capture.lock();
      } else if (event.type === "pointerlock") {
        if (event.locked && this._pausedByUnlock) {
          game.togglePause();
          this._pausedByUnlock = false;
        } else if (!event.locked && !game.isPaused()) {
          game.togglePause();
          this._pausedByUnlock = true;
        }
        this._notify();
      } else if (
        event.type === "keydown" &&
        event.code === pauseKey &&
        !event.repeat &&
        capture.locked &&
        focused === game
      ) {
        game.togglePause();
        this._pausedByUnlock = false;
        this._notify();
      }
    });
  }

  play() {
    this._capture.lock();
  }

  reset() {
    this._pausedByUnlock = !!this._getGame()?.isPaused();
    this._notify();
  }

  _notify() {
    this._onChange({locked: this._capture.locked, paused: !!this._getGame()?.isPaused()});
  }
}

// PlayOnTap plays the game on a touch screen, which has no pointer to lock:
// it starts paused, since scenes load paused, tapping the game with one
// finger while it is on top and paused plays it, and it pauses when the page
// is hidden, such as when switching apps, or when pause is called, such as
// from a pause button. onChange is called with {paused} whenever that
// changes, so the page can tell the player what to do.
//
// Its API: play(), such as when the player picks Resume in a menu, pause(),
// and reset(), to call when the scenes change, such as another track
// replacing the game.
export class PlayOnTap {
  constructor(capture, getRunners, onChange, {tapMs = 250, tapPixels = 10} = {}) {
    this._getGame = () => getRunners().findLast((runner) => runner.cameras);
    this._onChange = onChange;
    this.reset();

    // The fingers touching, by pointer id, with where and when each touched
    // down, and whether more than one touched in the current gesture.
    const touchesByID = new Map();
    let manyFingers = false;

    capture.onInput((event) => {
      const game = this._getGame();
      if (!game) {
        return;
      }

      if (event.type === "visibility" && event.hidden) {
        this.pause();
      } else if (event.kind === "touch" && event.type === "pointerdown") {
        manyFingers = manyFingers || touchesByID.size > 0;
        touchesByID.set(event.id, {x: event.x, y: event.y, ms: performance.now()});
      } else if (event.kind === "touch" && event.type === "pointerup") {
        const touch = touchesByID.get(event.id);
        touchesByID.delete(event.id);
        const tapped =
          touch &&
          !manyFingers &&
          performance.now() - touch.ms < tapMs &&
          Math.hypot(event.x - touch.x, event.y - touch.y) < tapPixels;
        if (!touchesByID.size) {
          manyFingers = false;
        }
        if (tapped && getRunners().at(-1) === game && game.isPaused()) {
          game.togglePause();
          this._notify();
        }
      }
    });
  }

  play() {
    const game = this._getGame();
    if (game?.isPaused()) {
      game.togglePause();
      this._notify();
    }
  }

  pause() {
    const game = this._getGame();
    if (game && !game.isPaused()) {
      game.togglePause();
      this._notify();
    }
  }

  reset() {
    this._notify();
  }

  _notify() {
    this._onChange({paused: !!this._getGame()?.isPaused()});
  }
}
