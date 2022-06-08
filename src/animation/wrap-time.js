// wrapTime will take elapsed time and wrap it around the duration correctly
// taking speed into account
//
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
export const wrapTime = (ms, d, s) => {
  const t = ((ms % (d / s)) * s) % d;
  return t === 0 && ms !== 0 && s !== 0 ? d : t;
};
