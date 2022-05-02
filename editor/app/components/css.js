export const styles = (styles) => {
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

export const classNames = (className) => {
  return [].concat(className).filter(Boolean).join(" ");
};
