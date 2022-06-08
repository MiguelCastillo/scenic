import {wrapTime} from "./wrap-time.js";

const MAX_LENGTH = Number.MAX_SAFE_INTEGER;

// Elapsed evaluates elapsed time (how log has gone by) relative to a
// continuesly advancing clock. This is most useful in animations where a
// global timer is always moving forward, but we want to be able to pause
// and resume an animation while staying in sync with the global timer.
//
// Why do we want this? So if there are multiple animations going on and some
// are pausing and resuming at different times, we want to advance the exact
// same number of milliseconds in _every_ running animation as they are all
// synced to the same global timer.
export class Elapsed {
  constructor(ms = 0) {
    // _offset is often the same as `_start` except for when an animation is
    // paused/played. In those cases we need to keep track of the times those
    // events happened so that we can correctly keep playback moving forward
    // relative to the global clock. Imagine that you paused the animation 5
    // seconds into the animation. We want to make sure that elapsed will keep
    // returning 5 seconds until we set the animation to `play` again. In that
    // case we have to continue the timer from 5 seconds regardless of how
    // much time has gone by in the global clock. So we keep updating _offset
    // everytime we pause and play an animation.
    this._offset = ms;

    // _pauseMs keeps track of the time at which playback is paused. This is
    // used for recalculating the _offset value once playback is resumed.
    this._pauseMs = 0;
  }

  reset = (ms) => {
    this._offset = ms;
    this._pauseMs = 0;
    return this;
  };

  skip = (msCount) => {
    this._offset -= msCount;
    return this;
  };

  resume = (ms) => {
    this.reset(this._offset + (ms - this._pauseMs));
    return this;
  };

  pause = (ms) => {
    this._pauseMs = ms;
    return this;
  };

  time = (ms, duration = MAX_LENGTH, speed = 1) => {
    const t = wrapTime((this._pauseMs || ms) - this._offset, duration, speed);
    return t < 0 && duration !== MAX_LENGTH ? duration + t : t;
  };
}

// Playback provides an abstraction for animation state that can be paused
// and resumed. This is the interface that animation itself uses for managing
// pausing and resuming of animation.
//
// All the different function take in absms which is absolute seconds that
// are provided by a global timer. The playback timer normalizes the global
// time (absolute timer) to relative elapsed time.
export class Playback {
  constructor(ms = 0) {
    this._elapsed = new Elapsed(ms);
    this.state = null;
    this.speed = 1;
  }

  elapsed = (ms, duration, speed) => {
    return this.state === "play"
      ? this._elapsed.time(ms, duration, speed)
      : this._elapsed.time(this._elapsed._pauseMs, duration, speed);
  };

  reset = (ms) => {
    this._elapsed.reset(ms);
    return this;
  };

  skip = (ms) => {
    this._elapsed.skip(ms);
    return this;
  };

  pause = (ms) => {
    this.state = "paused";
    if (ms != null) {
      this._elapsed.pause(ms);
    }
    return this;
  };

  play = (ms) => {
    this.state = "play";
    if (ms != null) {
      this._elapsed.resume(ms);
    }
    return this;
  };

  updateOffset = (ms, duration, speed) => {
    // NOTE: this is tightly coupled to the duration because the calculations
    // of the state that store in the _elapsed timer are derrived from the
    // provided duration.  So using updateOffset should only really be shared
    // for animation tracks with the same duration.
    // This behavior is a signal that playback should be initialized with a
    // duration if updateOffset is used, but for now a note is sufficient.

    if (this.speed === speed || speed == null) {
      return this;
    }

    const a = this.elapsed(ms, duration, speed);
    const b = this.elapsed(ms, duration, this.speed);
    const v = (a - b) / speed;

    this.skip(-v);
    this.speed = speed;
    return this;
  };
}
