import {fixed7} from "./math/angles.js";

export function rgbToHex(r, g, b) {
  let hex = [
    convert1to255(r),
    convert1to255(g),
    convert1to255(b),
  ]
  .map(c => c.toString(16))
  .map(c => c.length === 1 ? "0" + c : c)
  .join("");

  return `#${hex}`;
}

export function hexToRgb(hex) {
  const [, a, b, c] = hex.match(/^#(\w\w?)(\w\w?)(\w\w?)/);

  const rgb = [a, b, c]
    .map(c => c.length === 1 ? c + c : c)
    .map(c => parseInt(c, 16))
    .map(c => convert255to1(c));
  
  return rgb;
}

function convert1to255(v /*number*/) {
  return Math.floor(v * 255);
}

function convert255to1(v /*number*/) {
  return fixed7(v/255);
}
