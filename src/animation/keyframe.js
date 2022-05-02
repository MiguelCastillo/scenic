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

// https://www.khanacademy.org/computing/pixar/animate/ball/pi/animation-with-linear-interpolation
// https://www.freecodecamp.org/news/understanding-linear-interpolation-in-ui-animations-74701eb9957c/
const lerp = (fraction, min, max, ease = (x) => x) => {
  //const length = Math.sqrt(min*min + max*max);
  return ease((max - min) * fraction + min);
};

export class KeyController {
  // Right not we have just two things for animation. Frames and time intervals
  // for each frame (optional). If we needed more data than those two things,
  // we can create a KeyFrame object that can hold information about each
  // frame. Perhaps we want to support different ease function to transition
  // between frames.
  constructor(frames, times = [], duration = -1) {
    // Number of frames (segments) in an animation.
    const frameCount = frames.length;
    if (frameCount < 2) {
      // eslint-disable-next-line no-console
      console.log(
        `KeyController with ${frameCount} frame(s). Ideally animations would be more than 2 frames.`
      );
    }

    if (times.length && frames.length !== times.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `KeyController has mismatching number of frames (${frames.length}) and time intervals (${times.length}).`
      );
    }

    this.frames = frames;
    this.times = times;
    this.duration = times.length ? times[times.length - 1] : duration;
    this.segmentCount = frameCount - 1;
  }

  // The way this works is that ms is time in millisenconds
  // that is always advancing. And every second we will increase
  // or decrease the current frame depending on whether we are
  // going forward or backward with animation.
  getFrameIndex = (tms, speed = 1) => {
    const segmentCount = this.segmentCount;

    // Slow or speed things up! We also take the floor because
    // the decimal points can cause jitters in animations.
    let ms = Math.abs(Math.floor(tms * speed));

    // idx if the frame index the current time milliseconds (tms) corresponds
    // to.
    let idx;

    // len is how long a segment is between two frames. This is because an
    // animation can be made of frames that last more or less than other
    // frames.
    let len;

    // time corresponds to how long each frame is. Sometimes all frames last
    // the same amount of time, but not always.
    // If no times exist in the animation then we will default to every frame
    // lasting 1 second.
    const times = this.times;

    if (times.length) {
      const cms = ms % this.duration;

      if (!cms && ms) {
        // We are at the very end of the animation. So can return early since
        // there are no more calculations needed here.
        return [1, segmentCount - 1];
      } else {
        // TODO(miguel): cache index value so that we don't start over the
        // search everytime.
        for (idx = 0; idx < times.length; idx++) {
          if (cms < times[idx]) {
            break;
          }
        }

        len = times[idx] - times[idx - 1];
        idx--;
      }
    } else {
      idx = Math.floor(ms * 0.001);
      len = 1000;
    }

    // delta tells us where within a frame range we are so that we can
    // interpolate data within frames each second.
    // We use division here instead of 0.001 multiplication because
    // that handles floating point seemingly better. A particular example
    // that causes tests to fail when ms is 9.
    // 9 * 0.001 yields 0.009000000000000001. But it really should be 0.009.
    // https://techformist.com/problems-with-decimal-multiplication-javascript/
    let delta = (ms % len) / len;

    if (!delta && idx) {
      // The adjustment in this logic branch allows us to access all the data
      // in the very last frame while generating array indexes that can
      // interpolate frames with
      // lerp(delta, this.frames[index], this.frames[index + 1]).
      //
      // Without this adjustment,  we would generate frame indexes that will
      // go out of bound when we hit `this.frames[index + 1]`.
      //
      // So we return the index for cp1 and the delta of 1 which tells lerp to
      // use the value at cp2. Which is exactly lerp's job.
      //
      //  |----------|----------|
      // cp0        cp1        cp2
      //

      delta = 1;
      idx--;
    }

    idx = idx % segmentCount;

    if (speed < 0) {
      // If we are in reverse mode then we just invert the computed values.
      idx = segmentCount - idx - 1;
      delta = 1 - delta;
    }

    return [delta, idx];
  };
}

export class AnimateScalar {
  constructor(frames, times = []) {
    this.frames = frames;
    this.times = times;
    this.controller = new KeyController(frames, times);
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

export const keyframe = animate3v;
