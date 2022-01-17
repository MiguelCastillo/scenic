// Keyframe animation is based on segments that have a start and an end.
// The start of a segment is the value of a frame and the end of that
// same segment is the start of a the next frame. Where a segment ends is
// exaclty where another one starts; they produce the same value. More on
// this later.
//
// In an animation, we iterate thru these segments and want to do that
// as smoothly as possible over time. In order to do that we interpolate
// the values of the start and the end of a segement as time goes by. The
// interpolation between these values are linear over time so we call it
// linear interpolation. When we interpolate the start and end of a segment
// we need to measure how much time has gone by since the start of the
// segment. This measure is called delta and it is a value between 0 and 1
// where 0 lies exactly on the start of the segment and 1 lies exactly at
// end of the segment.
//
// To illustrate delta, let's assume for a minute that a segment is 1 second
// long, meaning it takes 1 second to go from the start to the end. At 0
// seconds we are at the very start of the segment. At 250 milliseconds we
// have a 0.25 delta which is 1/4 of the way into the segment, at 500
// milliseconds we have a delta of 0.5 and are at the midpoint of the segment
// and so on. We can think of this also in terms of percentages where 250
// milliseconds is 25% of the segment, 500 milliseconds is 50% of the segment
// and so on. So 20% of a second is 0.2 milliseconds.
// 
// More concretely as illustrated below, `s` denotes a segment and we have 3
// of them. So segment 1 starts at 0 seconds and ends at 1 second. Segment
// 2 starts at 1 second and ends at 2 seconds. And so on. Now imagine that
// frame 1 lies on the start of s1 and frame 2 lies on the start of segment
// 2. When we interpolate with delta we are basically figuring out how much
// of frame 1 and how much of frame 2 we have to use in order to  generate
// the final frame. Without interpolation s1 is basically frame 1.
//
// * cp below are curve points, which is a common term used to describe each
// data point in an animation curve.
//
//       s1         s2         s3
//  |----------|----------|----------|
// cp0        cp1        cp2        cp3
//


// https://www.khanacademy.org/computing/pixar/animate/ball/pi/animation-with-linear-interpolation
// https://www.freecodecamp.org/news/understanding-linear-interpolation-in-ui-animations-74701eb9957c/
const lerp = (fraction, min, max, ease=(x) => x) => {
  //const length = Math.sqrt(min*min + max*max);
  return ease(((max - min) * fraction) + min);
}

export const animateScalar = (frames, times, ease) => {
  const controller = animationCurveController(frames, times);

  return (ms, speed) => {
    const [delta, index] = controller(ms, speed);
    return lerp(delta, frames[index], frames[index+1], ease);
  };
};

export const animate2v = (frames, times, ease) => {
  const controller = animationCurveController(frames, times);

  return (ms, speed) => {
    const [delta, index] = controller(ms, speed);
    return [
      lerp(delta, frames[index][0], frames[index+1][0], ease),
      lerp(delta, frames[index][1], frames[index+1][1], ease),
    ];
  };
};

export const animate3v = (frames, times, ease) => {
  const controller = animationCurveController(frames, times);

  return (ms, speed) => {
    const [delta, index] = controller(ms, speed);
    return [
      lerp(delta, frames[index][0], frames[index+1][0], ease),
      lerp(delta, frames[index][1], frames[index+1][1], ease),
      lerp(delta, frames[index][2], frames[index+1][2], ease),
    ];
  };
};

export const keyframe = animate3v;

function animationCurveController(frames, times=[]) {
  const curvePointCount = frames.length;
  if (curvePointCount < 2) {
    throw new Error("there must be at least 2 markers.");
  }

  const animationLength = times.length ? times[times.length-1] : -1;

  // Number of segments in an animation.
  const segmentCount = curvePointCount - 1;

  // The way this works is that ms is time in millisenconds
  // that is always advancing. And every second we will increase
  // or decrease the current frame depending on whether we are
  // going forward or backward with animation.
  return (tms, speed=1) => {
    // Slow or speed things up! We also take the floor because
    // the decimal points can cause jitters in animations.
    let ms = Math.abs(Math.floor(tms*speed));
    let idx, len;

    if (times.length) {
      const cms = ms % animationLength;
      if (!cms && ms) {
        // We are at the very end of the animation.
        idx = segmentCount;
        len = times[idx] - times[idx-1];
      } else {
        // TODO(miguel): cache index value so that we don't start over the
        // search everytime.
        for (idx = 0; idx < times.length; idx++) {
          if (cms < times[idx]) {
            break;
          }
        }

        // Segment length is how long in milliseconds are segment is.
        // This tells us when we jump to the next keyframe.
        len = times[idx] - times[idx-1];

        idx--;
      }

      ms = cms;
    } else {
      idx = Math.floor(ms*0.001), len = 1000;
    }

    // Each second is where markers are for each frame. So dividing
    // milliseconds by 1000 tells us the frame. We normalize the frame
    // number to array indexes tho because these eventually map to arrays
    // with frame data. curvePointIndex always points to the beginning
    // of the segment.
    let curvePointIndex = idx;

    // delta tells us where within a frame range we are so that we can
    // interpolate data within frames each second.
    // We use division here instead of 0.001 multiplication because
    // that handles floating point seemingly better. A particular example
    // that causes tests to fail when ms is 9.
    // 9 * 0.001 yields 0.009000000000000001. But it really should be 0.009.
    // https://techformist.com/problems-with-decimal-multiplication-javascript/
    let delta = (ms % len)/len;

    //
    //  |----------|----------|
    // cp0        cp1        cp2
    //
    if (!delta && curvePointIndex) {
      // This adjustment allows us to access all the data in the very
      // last frame. Basically instead of taking frame X with delta
      // 0, we take frame - X with delta of 1. It will yield the same
      // result, but we do this adjusment so that we can access the very
      // last datapoint in a frame while staying withing range in the
      // array of frame data. 
      delta = 1;
      curvePointIndex--;
    }

    curvePointIndex = curvePointIndex % segmentCount;

    if (speed < 0) {
      // If we are in reverse mode then we just invert the current state.
      curvePointIndex = segmentCount - curvePointIndex - 1;
      delta = 1-delta;
    }

    return [delta, curvePointIndex];
  }
}
