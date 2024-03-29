// Clamp floating point to 7 decimal places. Not too big to prevent floating
// point issues, and not too small to lose resolution when working with sine
// cosine functions.
import {fixed7f} from "./float.js";

// Convert degrees to radians which is what Math.sin and Math.cos want.
const _degToRadMultiplier = fixed7f(Math.PI / 180);
export const degToRad = (d) => d * _degToRadMultiplier;

const _radToDegMultiplier = fixed7f(180 / Math.PI);
export const radToDeg = (r) => r * _radToDegMultiplier;

// Helper function to keep degrees in the range of 0 to 360 where 0 is
// equivalent to 360 degrees. The reason the range is from 0 to 360 is that
// those are the indexes into the sine and cosine tables. The sin and cos
// functions automatically clamp degrees. But feel free to use in any client
// code if you wish to constrain angles you store so that they don't grow in
// the positive or negative direction unbounded.
export const clampDegrees = (degrees) => {
  const clamped = degrees % 360;

  if (clamped < 0) {
    return 360 + clamped;
  }

  return clamped;
};

// Tables with precomputed sine and cosine values. This is an optimization to
// avoid calculating these values at runtime every time we are dealing with
// angle. Instead we are converting this to a precomputed table indexed by
// degrees.
//
// Math.sin and Math.cos in JavaScript both take in angles in radians. So we
// need to translate all 360 degrees to radians before feeding it to the math
// functions while still keeping the 0 to 359 indexes mapping to degrees.
export const cosine = [...new Array(361).keys()].map(degToRad).map(Math.cos).map(fixed7f);
export const sine = [...new Array(361).keys()].map(degToRad).map(Math.sin).map(fixed7f);

// Functions to get back sine and cosine values for degrees using the
// precomputed table of angles.
export const cos = (degrees) => {
  // return cosine[clampDegrees(degrees)];
  return Math.cos(degToRad(degrees));
};

export const acos = (degrees) => {
  return Math.acos(degToRad(degrees));
};

export const sin = (degrees) => {
  // return sine[clampDegrees(degrees)];
  return Math.sin(degToRad(degrees));
};

export const atan2 = (degreesA, degreesB) => {
  return Math.atan2(degToRad(degreesA), degToRad(degreesB));
};
