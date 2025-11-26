export const buildStyles = (styles) => {
  return []
    .concat(styles)
    .filter(Boolean)
    .reduce((acc, style) => {
      return {
        ...acc,
        ...style,
      };
    }, {});
};

export const buildClassNames = (className) => {
  return [].concat(className).join(" ");
};
