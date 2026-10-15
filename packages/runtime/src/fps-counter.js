// Calculates the number of frames per second. This is accomplished mostly by
// taking the numer of millisenconds between calls to udpate the frame counter
// and every second that goes by, we determine how many frames have been
// counted. The number of milliseconds in the calculations are optimal when
// using requestAnimationFrame, which will provide the the milliseconds the way
// we need them for frame rate calculations.
export function createFrameRateCounter() {
  let lastMs = 0;
  let elapsedMs = 0;
  let frameCount = 0;
  let frameRate = 0;

  return function calculateFrameRate(ms) {
    // Report frame rate. How many frames a second did we get.
    elapsedMs = ms - lastMs;
    frameCount++;

    if (elapsedMs > 1000) {
      frameRate = Math.floor(frameCount * (1000 / elapsedMs));
      lastMs = ms;
      frameCount = 0;
    }

    return {
      frameRate,
      elapsedMs,
    };
  };
}
