// Elapsed provides functionality for evaluating elapsed time relative to a
// continuesly advancing clock. This is most useful in animations where a
// global timer is always moving forward, but we want to be able to pause
// and resume an animation while staying in sync with the global timer.
//
// The example below is an animation timer that starts at 0 and it's paused at
// 5 seconds. The absolute timer is at 10 seconds, but elpased seconds in the
// animation timer will still return 5 because the timer was paused at 5
// seconds. When we resume the animation, we will continue animation from 5
// seconds advancing relative to the global timer which is at 10 seconds, so
// elapsed time will still be 5.
//
// start   offset   current
// |=======|========|
// 0       5        10
//
// An important feature is that we can start the timer at any given point
// relative to the global timer. So if the global timer is at 10 seconds,
// elapsed times will be normalized by substracting those 10 seconds.
//
// start   offset   current
// |=======|========|
// 10      15       20
//
// Why do we want this? So if there are multiple animations going on and some
// are pausing and resuming at different times, we want to advance the exact
// same number of milliseconds in _every_ running animation as they are all
// synced to the same global timer.
export class Elapsed {
  constructor(ms = 0) {
    this.reset(ms);
  }

  reset = (ms) => {
    this._start = this._offset = ms;
    return this;
  };

  skip = (ms) => {
    this._offset += ms;
    return this;
  };

  resume = (ms) => {
    return this._updateOffset(ms);
  };

  pause = (ms) => {
    return this._updateOffset(ms);
  };

  _updateOffset = (ms) => {
    this._offset = ms - this.current;
    return this;
  };

  // time returns how much time has elapsed since the start of the animation.
  time = (ms) => {
    return ms - this._offset;
  };

  // current is the amount of time between the start of the animation and the
  // last time the animation was paused or resumed. For example, if the
  // animation was paused 5 seconds in, then this cursor value will be 5
  // seconds.
  get current() {
    return this._offset - this._start;
  }
}

// Playback provides an abstraction for animation state that can be paused
// and resumed. This is the interface that animation itself uses for managing
// pausing and resuming of animation.
//
// All the different function take in absms which is absolute seconds that
// are provided by a global timer. The playback timer normalizes the global
// time (absolute timer) to relative elapsed time.
export class Playback {
  constructor(absms) {
    this._elapsed = new Elapsed(absms);
    this.state = "unstarted";
  }

  elapsed = (absms) => {
    return this.state === "play" ? this._elapsed.time(absms) : this._elapsed.current;
  };

  reset(absms) {
    this._elapsed.reset(absms);
    this.state = "paused";
    return this;
  }

  start = () => {
    this.state = "play";
    return this;
  };

  skip = (absms) => {
    this._elapsed.skip(absms);
    return this;
  };

  pause = (absms) => {
    this._elapsed.pause(absms);
    this.state = "paused";
    return this;
  };

  play = (absms) => {
    this._elapsed.resume(absms);
    this.state = "play";
    return this;
  };
}
