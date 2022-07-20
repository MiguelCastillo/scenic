export const fixedFloat = (precision) => (a) =>
  !a ? 0 : parseFloat(parseFloat(a).toFixed(precision));
export const fixed3f = fixedFloat(3);
export const fixed5f = fixedFloat(5);
export const fixed7f = fixedFloat(7);
export const matrixFloatPrecision = fixedFloat(5);
