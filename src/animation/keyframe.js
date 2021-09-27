export const keyframe = (frames, ease=(x) => x) => {
  if (!frames || frames.length < 2) {
    throw new Error("Frames must be an array with at least 2 items.");
  }

  // https://www.khanacademy.org/computing/pixar/animate/ball/pi/animation-with-linear-interpolation
  // https://www.freecodecamp.org/news/understanding-linear-interpolation-in-ui-animations-74701eb9957c/
  const lerp = (min, max, fraction) => {
    //const length = Math.sqrt(min*min + max*max);
    return ease(((max - min) * fraction) + min);
  }

  let prevMs;
  let currentFrame;
  let nextFrame;

  // The way this works is that ms is time in millisenconds
  // that is always advancing. And every second we will increase
  // or decrease the current frame depending on whether we are
  // going forward or backward with animation.
  // One way to think about frames here is like a window that's
  // based on the current frame and the next frame. That window
  // will move back or forward depending on the direction of the
  // animation. And within that window, we will lerp left or
  // or right depending on the direction of the animation.
  return (ms, speed=1) => {
    ms = Math.floor(ms * Math.abs(speed));

    // First time this thing runs. Let's initialize local state!
    if (currentFrame === undefined) {
      prevMs = ms;
      currentFrame = 0;
      nextFrame = currentFrame + 1;
    }

    let timeDelta = ms - prevMs;

    // Every second we will increment the frame. But within each second
    // we will lerp so that we can get a smooth animation.
    // When we advance each frame, it is not always the case that exactly
    // 1 second has elapsed since the last frame. So we take the current
    // time delta, and will subtract 1 sec. The remainder is used to
    // lerp part of the new frame to provide a smooth transition between
    // frames even when the system does not advance each frame exactly
    // every second.
    if (timeDelta > 1000) {
      if (speed >= 0) {
        currentFrame++;
        if (currentFrame === frames.length - 1) {
          currentFrame = 0;
        }
      } else {
        currentFrame--;
        if (currentFrame === -1) {
          currentFrame = frames.length - 2;
        }
      }

      timeDelta -= 1000;
      nextFrame = currentFrame + 1;
      prevMs = ms;
    }


    // If the speed is positive that means that delta is going
    // to increase over time from 0 to 1. If speed is negative
    // then delta will decrease over time from 1 to 0. That
    // allows us to come up with multipliers for lerp that move
    // frame interpolation forward or backward.
    let delta = speed >= 0 ? timeDelta/1000 : (1 - timeDelta/1000);

    const result = [
      lerp(frames[currentFrame][0], frames[nextFrame][0], delta),
      lerp(frames[currentFrame][1], frames[nextFrame][1], delta),
      lerp(frames[currentFrame][2], frames[nextFrame][2], delta),
    ];

    return result;
  };
}
