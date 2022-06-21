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
    this.duration = 0;
  }

  _calculateElapsed = (ms, duration, speed) => {
    return this.state === "play"
      ? this._elapsed.time(ms, duration, speed)
      : this._elapsed.time(this._elapsed._pauseMs, duration, speed);
  };

  elapsed = (ms) => {
    return this._calculateElapsed(ms, this.duration, this.speed);
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

  setDuration = (duration) => {
    this.duration = duration;
    return this;
  };

  // setSpeed sets the speed for playback. When the milliseconds for the
  // current tick are provided then this also updates time offsets for
  // smoothly transitioning to the new speed. If you do not provide the
  // milliseconds and the animation has started then then times generated for
  // playback will potentially cause frames to be skipped and the animation
  // will look jumpy when using the new speed for the first time to generate
  // elapsed time.
  // When milliseconds for the current tick are provided then calling playback
  // elapsed will return the normalized elapsed time when you provide the same
  // milliseconds to playback.elapsed. Meaning, calling elapsed  with
  // the milliseconds for the current tick will return the same exact elapsed
  // value before and after calling setSpeed with the same milliseconds.
  // Thus you usually call setSpeed and in the same tick you call elapsed.
  setSpeed = (speed, ms) => {
    if (this.speed === speed || speed == null) {
      return this;
    }

    if (ms == null) {
      this.speed = speed;
      return this;
    }

    const a = this._calculateElapsed(ms, this.duration, speed);
    const b = this._calculateElapsed(ms, this.duration, this.speed);
    return this.skip((b - a) / speed).setSpeed(speed);
  };
}
