import {lerp} from "../math/lerp.js";

// Keyframe animation is the notion that state changes over time in which the
// state is defined by a frame; frames are snapshots of some state at discrete
// points in time.
//
// In some abstract way keyframe animation can also be thought of as a
// collection of segments with duration t time where the start and end of
// a segment are two separate frames. In animation, we want to transition
// between the frames in over the duration of the segment.
//
// Imagine an animation with frames `a` and `b` where `a` is the position of a
// car at t 0 seconds and `b` is the position of the car at t 20 seconds.
// This has 2 parts:
// 1. two frames
// 2. a segment with duration of 20 seconds.
//
// The job here is to animation these two frames by interpolating the data from
// both frames over the course of 20 seconds. Meaning, interpolate the positions
// of the at frame `a` and `b` so that it seems like the car is smoothly moving
// between the start and end positions over time.
//
// Interpoliation relies on figuring out how much time goes by during the 20
// seconds of the segment. That number that tells us how far we are until we
// reach 20 seconds is called delta and we use that value to know how much
// from frame `a` and how much from `b` we need to use order to know where
// the car is at any particular time in those 20 seconds. Delta is capped at
// 1 so that it can be easily used a percentage of time over the duration
// of the segment. When delta is .25 it means we are taking 25% from frame `a`
// and 75% from frame `b`. Said differently, the animation is 5 seconds into
// the segment.
//

// KeyController manages frames in a key frame animation and provide a method
// to calculate the frame index at any particular point in time in the
// animaiton. The index generated will include a delta value for linear
// interpolation.
export class KeyController {
  // Right now we have just two things for animation. Frames and time intervals
  // for each frame (optional). If we needed more data than those two things,
  // we can create a KeyFrame object that can hold information about each
  // frame. Perhaps we want to support different ease function to transition
  // between frames.
  // duration is how long the animation is in Milliseconds!
  constructor(frames, times = [], duration = -1) {
    // Number of frames (segments) in an animation.
    const frameCount = frames.length;
    if (frameCount < 2) {
      // eslint-disable-next-line no-console
      console.log(
        `KeyController with ${frameCount} frame(s). Ideally animations would be more than 2 frames.`
      );
    }

    // When no time intervals are provided we just create them ourselves and
    // give each interval (segment) a 1 second length. This simplifies the logic
    // for calculating the frame index for a particular point in time in the
    // animation.
    if (!times.length) {
      const segmentLength = duration !== -1 ? frames.length / duration : 1000;
      times = frames.map((_, i) => i * segmentLength);
    }

    if (frames.length !== times.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `KeyController has mismatching number of frames (${frames.length}) and time intervals (${times.length}).`
      );
    }

    this.times = times;
    this.frames = frames;
    this.segmentCount = frameCount - 1;

    if (duration !== -1) {
      this.duration = duration;
    } else if (times.length) {
      this.duration = times[times.length - 1];
    } else {
      this.duration = this.segmentCount * 1000;
    }
  }

  // getFrameIndex returns the index of the current frame index and delta for
  // the time provided in the animation. speed controls how fast we advance
  // frames, or go in reverse when speed is negative.
  //
  // This function will loop animation. Meaning that if time provided to this
  // function is bigger than the duration, we will just continue calculations
  // from the beginning of the animation. If you don't want looping you can
  // use an abstraction that manages time before it is passed into this
  // function.
  //
  // Animation looping has a subtle behavior that can be very confusing. When
  // looping an animation the very last frame and the very first frame fall in
  // the same time slot. Meaning when we get to the very last frame of the
  // animation, that time will also corresponding to the beginning of the next
  // loop's very first frame.
  // To illustrates what looping looks like consider 5 frames that are looped:
  // [1, 2, 3, 4, 5] first iteration
  //             [1, 2, 3, 4, 5] looped over
  //
  // Notices how the 1 and the 5 overlap. That helps us align time that is
  // always running consistently so that we can render frame 2 exactly 1 second
  // after we finished the first iteration. And we rely on continue time to
  // allow us to lineraly interpolate the values between 1 and 2.  The focus of
  // the behavior to allow us to run an animation from the very beginning to the
  // very end of the animation while providing reasonable looping behavior that
  // relise on lerp to fill in the gaps.
  //
  // This is actually much more clearly illustrated when we are animation 360
  // degrees like we wouldo do when rotation an object in circles.
  // Let's say that an animation is 360 seconds and every second we animate
  // 1 degree. At second 360 we want to animate exactly at 360 degrees. And at
  // second 361 we want to render degree 361, which is equivalent to 1 degree.
  // And 360 degree is actually the same as 0 degrees.
  // [358, 359, 360] first iteration
  //           [  0, 1, 2] second iteration (second loop)
  //
  // The confusion gets amplified when we have speeds other than 1. For example,
  // speed of 2 in our above example means that we will jump from 360 to 2
  //
  getFrameIndex = (ms, speed = 1) => {
    const segmentCount = this.segmentCount;
    const times = this.times;
    const duration = this.duration;

    // frameIndex is the frame index the current time milliseconds (tms)
    // corresponds to.
    let frameIndex = 0;

    // delta tells us where within a frame range we are so that we can
    // interpolate frames.
    let delta = 0;

    // We wrap the time provided to loop the animation. This is particularly
    // important when we are speeding up animation playback.
    // NOTE: wrapping time can have two ways for dealing when animation reaches
    // the very end:
    // 1. wrapTime will start animation at 0.
    // 2. wrapTime returns duration.
    //
    // To illustrate, consider an animation that last 5 seconds. When the
    // elapsed time has reached 5 seconds exactly. wrapTime could return
    // 5 or it could return 0 depending on how you want your times to be
    // wrapped. The current implementation will wrap time back to 0.
    //
    // The logic for generating frame indexes and delta values will handle
    // both cases.
    const cms = wrapTime(ms, duration, speed);

    if (cms) {
      // Find the index for the frame for the corresponding point in time.
      for (
        frameIndex = 0;
        frameIndex < times.length && !(cms <= times[frameIndex]);
        frameIndex++
      ) {}
      const len = times[frameIndex] - times[frameIndex - 1];
      delta = (cms - times[frameIndex - 1]) / len;
      frameIndex--;
    } else if (ms) {
      // This handles the sitation where wrapping time goes back to 0 seconds
      // when we are at very end of the animation.
      //
      // The adjustment in this logic branch allows us to access all the data
      // in the very last frame while generating array indexes that can
      // interpolate frames with
      // lerp(delta, this.frames[index], this.frames[index + 1])
      frameIndex = segmentCount - 1;
      delta = 1;
    }

    if (speed < 0) {
      // If we are in reverse mode then we just invert the computed values.
      frameIndex = segmentCount - frameIndex - 1;
      delta = 1 - delta;
    }

    return [delta, frameIndex];
  };
}

export class AnimateScalar {
  constructor(frames, times = []) {
    this.frames = frames;
    this.times = times;
    this.controller = new KeyController(frames, times);
  }

  get duration() {
    return this.controller.duration;
  }

  animate = (ms, speed, ease) => {
    const [delta, index] = this.controller.getFrameIndex(ms, speed);
    return lerp(delta, this.frames[index], this.frames[index + 1], ease);
  };
}

export class Animate2v {
  constructor(frames, times = []) {
    this.frames = frames;
    this.times = times;
    this.controller = new KeyController(frames, times);
  }

  get duration() {
    return this.controller.duration;
  }

  animate = (ms, speed, ease) => {
    const [delta, index] = this.controller.getFrameIndex(ms, speed);
    const frames = this.frames;
    return [
      lerp(delta, frames[index][0], frames[index + 1][0], ease),
      lerp(delta, frames[index][1], frames[index + 1][1], ease),
    ];
  };
}

export class Animate3v {
  constructor(frames, times = []) {
    this.frames = frames;
    this.times = times;
    this.controller = new KeyController(frames, times);
  }

  get duration() {
    return this.controller.duration;
  }

  animate = (ms, speed, ease) => {
    const [delta, index] = this.controller.getFrameIndex(ms, speed);
    return [
      lerp(delta, this.frames[index][0], this.frames[index + 1][0], ease),
      lerp(delta, this.frames[index][1], this.frames[index + 1][1], ease),
      lerp(delta, this.frames[index][2], this.frames[index + 1][2], ease),
    ];
  };
}

export const animateScalar = (frames, times, ease) => {
  const animator = new AnimateScalar(frames, times);
  return (ms, speed) => {
    return animator.animate(ms, speed, ease);
  };
};

export const animate2v = (frames, times, ease) => {
  const animator = new Animate2v(frames, times);
  return (ms, speed) => {
    return animator.animate(ms, speed, ease);
  };
};

export const animate3v = (frames, times, ease) => {
  const animator = new Animate3v(frames, times);
  return (ms, speed) => {
    return animator.animate(ms, speed, ease);
  };
};

export const wrapTime = (ms, duration, speed = 1) => {
  return Math.abs(ms * speed) % duration;

  // NOTE(miguel):
  // This approach will apply speed changes after the given time is wrapped.
  // It actually generates the same exact values as applying the speed changes
  // to the provided time directly before wrapping around the duration.
  // It is a lot more work and confusing code for no real benefit. So we don't
  // use it an only have it for reference.
  //
  // const _time = (t, duration) => t <= duration ? t : t - duration * Math.floor(t / duration);
  // const s = Math.abs(speed);
  // let t = _time(Math.abs(ms), duration/s);
  // if (speed !== 1) {
  //   t = _time(t * s, duration);
  // }
  // return t;
};
