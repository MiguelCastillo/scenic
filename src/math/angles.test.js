import {clampDegrees} from "./angles.js";

test("clampDegrees 1 returns 1", () => {
  expect(clampDegrees(1)).toEqual(1);
});

test("clampDegrees 0 returns 0", () => {
  expect(clampDegrees(0)).toEqual(0);
});

test("clampDegrees -0 returns -0", () => {
  expect(clampDegrees(-0)).toEqual(-0);
});

test("clampDegrees -1 returns 359", () => {
  expect(clampDegrees(-1)).toEqual(359);
});

test("clampDegrees 359 return 359", () => {
  expect(clampDegrees(359)).toEqual(359);
});

test("clampDegrees -360 return 0", () => {
  expect(clampDegrees(360)).toEqual(0);
});

test("clampDegrees -720 return 0", () => {
  expect(clampDegrees(360*3)).toEqual(0);
});

test("clampDegrees 360 return 0", () => {
  expect(clampDegrees(360)).toEqual(0);
});

test("clampDegrees 720 return ", () => {
  expect(clampDegrees(360*3)).toEqual(0);
});
