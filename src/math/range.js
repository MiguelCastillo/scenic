// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#sequence_generator_range
export const range = (start, stop, step = 1) =>
  Array.from({length: (stop - start) / step + 1}, (_, i) => start + i * step);
