// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#sequence_generator_range
export const range = (start, stop, step = 1) => {
  const length = Math.round((stop - start) / step + 1);
  return Array.from({length}, (_, i) => start + i * step);
};
