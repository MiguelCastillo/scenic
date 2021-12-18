import {keyframe} from "./keyframe.js";

test("no frames throws error", () => {
  expect(() => {
    keyframe([])
  }).toThrowError(new Error("Frames must be an array with at least 2 items."));
});

test("with 1 frame throws error", () => {
  expect(() => {
    keyframe([[6,7,8]])
  }).toThrowError(new Error("Frames must be an array with at least 2 items."));
});

test("with 2 frames with multiple MS interval from 0 to 1 sec", () => {
  const animator = keyframe([[1, 2, 3], [6, 7, 8]]);

  // (6-1)*0 + 1 = 0 + 1 = 1
  // (7-2)*0 + 2 = 0 + 2 = 2
  // (8-3)*0 + 3 = 0 + 3 = 3
  expect(animator(0)).toEqual([1, 2, 3]);

  // (6-1)*0.5 + 1 = 5*0.5 + 1 = 3.5
  // (7-2)*0.5 + 2 = 5*0.5 + 2 = 4.5
  // (8-3)*0.5 + 3 = 5*0.5 + 3 = 5.5
  expect(animator(500)).toEqual([3.5, 4.5, 5.5]);

  // (6-1)*0.55 + 1 = 5*0.55 + 1 = 3.75
  // (7-2)*0.55 + 2 = 5*0.55 + 2 = 4.75
  // (8-3)*0.55 + 3 = 5*0.55 + 3 = 5.75
  expect(animator(550)).toEqual([3.75, 4.75, 5.75]);

  // (6-1)*0.6 + 1 = 5*0.6 + 1 = 4
  // (7-2)*0.6 + 2 = 5*0.6 + 2 = 5
  // (8-3)*0.6 + 3 = 5*0.6 + 3 = 6
  expect(animator(600)).toEqual([4, 5, 6]);

  // (6-1)*0.65 + 1 = 5*0.65 + 1 = 4.25
  // (7-2)*0.65 + 2 = 5*0.65 + 2 = 5.25
  // (8-3)*0.65 + 3 = 5*0.65 + 3 = 6.25
  expect(animator(650)).toEqual([4.25, 5.25, 6.25]);

  // (6-1)*0.7 + 1 = 5*0.7 + 1 = 4.5
  // (7-2)*0.7 + 2 = 5*0.7 + 2 = 5.5
  // (8-3)*0.7 + 3 = 5*0.7 + 3 = 6.5
  expect(animator(700)).toEqual([4.5, 5.5, 6.5]);

  // (6-1)*0.75 + 1 = 5*0.75 + 1 = 4.75
  // (7-2)*0.75 + 2 = 5*0.75 + 2 = 5.75
  // (8-3)*0.75 + 3 = 5*0.75 + 3 = 6.75
  expect(animator(750)).toEqual([4.75, 5.75, 6.75]);

  // (6-1)*0.8 + 1 = 5*0.8 + 1 = 5
  // (7-2)*0.8 + 2 = 5*0.8 + 2 = 6
  // (8-3)*0.8 + 3 = 5*0.8 + 3 = 7
  expect(animator(800)).toEqual([5, 6, 7]);

  // (6-1)*0.85 + 1 = 5*0.85 + 1 = 5.25
  // (7-2)*0.85 + 2 = 5*0.85 + 2 = 6.25
  // (8-3)*0.85 + 3 = 5*0.85 + 3 = 7.25
  expect(animator(850)).toEqual([5.25, 6.25, 7.25]);

  // (6-1)*0.95 + 1 = 5*0.95 + 1 = 5.75
  // (7-2)*0.95 + 2 = 5*0.95 + 2 = 6.75
  // (8-3)*0.95 + 3 = 5*0.95 + 3 = 7.75
  expect(animator(950)).toEqual([5.75, 6.75, 7.75]);

  // Every second we will start a new frame so the multiplier
  // for linear interpolation (lerp) starts at 0 again.
  // (6-1)*1 + 1 = 5 + 1 = 6
  // (7-2)*1 + 2 = 5 + 2 = 7
  // (8-3)*1 + 3 = 5 + 3 = 8
  expect(animator(1000)).toEqual([6, 7, 8]);

  // Every second we will start a new frame so the multiplier
  // for linear interpolation (lerp) starts at 0 again.
  // (6-1)*.001 + 1 = .005 + 1 = 1.005
  // (7-2)*.001 + 2 = .005 + 2 = 2.005
  // (8-3)*.001 + 3 = .005 + 3 = 3.005
  expect(animator(1001)).toEqual([1.005, 2.005, 3.005]);
});

test("with 2 frames with multiple MS interval from 0 to 1 sec in reverse", () => {
  const animator = keyframe([[1, 2, 3], [6, 7, 8]]);

  // (6-1)*1 + 1 = 5 + 1 = 6
  // (7-2)*1 + 2 = 6 + 2 = 7
  // (8-3)*1 + 3 = 7 + 3 = 8
  expect(animator(0, -1)).toEqual([6, 7, 8]);

  // (6-1)*(0.5) + 1 = 5*(0.5) + 1 = 3.5
  // (7-2)*(0.5) + 2 = 5*(0.5) + 2 = 4.5
  // (8-3)*(0.5) + 3 = 5*(0.5) + 3 = 5.5
  expect(animator(500, -1)).toEqual([3.5, 4.5, 5.5]);

  // (6-1)*(0.25) + 1 = 5*(0.25) + 1 = 2.25
  // (7-2)*(0.25) + 2 = 5*(0.25) + 2 = 3.25
  // (8-3)*(0.25) + 3 = 5*(0.25) + 3 = 4.25
  expect(animator(750, -1)).toEqual([2.25, 3.25, 4.25]);

  // (6-1)*(0.15) + 1 = 5*(0.15) + 1 = 1.75
  // (7-2)*(0.15) + 2 = 5*(0.15) + 2 = 2.75
  // (8-3)*(0.15) + 3 = 5*(0.15) + 3 = 3.75
  expect(animator(850, -1)).toEqual([1.75, 2.75, 3.75]);

  // (6-1)*(0) + 1 = 5*(0) + 1 = 1
  // (7-2)*(0) + 2 = 5*(0) + 2 = 2
  // (8-3)*(0) + 3 = 5*(0) + 3 = 3
  expect(animator(1000, -1)).toEqual([1, 2, 3]);

  // (6-1)*(.999) + 1 = 5*(0.999) + 1 = 5.995
  // (7-2)*(.999) + 2 = 5*(0.999) + 2 = 6.995
  // (8-3)*(.999) + 3 = 5*(0.999) + 3 = 7.995
  expect(animator(1001, -1)).toEqual([5.995, 6.995, 7.995]);
});
