// Clamp floating point to 7 decimal places. Not too big to prevent floating
// point issues, and not too small to lose resolution when working with sine
// cosine functions.
export const fixed7f = a => {
	return !a ? 0 : parseFloat(parseFloat(a).toFixed(7));
}

// Convert degrees to radians which is what Math.sin and Math.cos want.
export const degToRad = (d) => d * Math.PI / 180;

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
}

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
	return fixed7f(Math.cos(degToRad(degrees)));
};

export const sin = (degrees) => {
	// return sine[clampDegrees(degrees)];
	return fixed7f(Math.sin(degToRad(degrees)));
};
