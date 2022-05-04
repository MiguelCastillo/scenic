// https://www.khanacademy.org/computing/pixar/animate/ball/pi/animation-with-linear-interpolation
// https://www.freecodecamp.org/news/understanding-linear-interpolation-in-ui-animations-74701eb9957c/
export const lerp = (fraction, min, max, ease = (x) => x) => {
  //const length = Math.sqrt(min*min + max*max);
  return ease((max - min) * fraction + min);
};
