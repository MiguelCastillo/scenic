import {
  animate3v,
  animateScalar,
} from "./keyframe.js";

test("animate3v no frames throws error", () => {
  expect(() => {
    animate3v([])
  }).toThrowError(new Error("there must be at least 2 markers."));
});

test("animate3v with 1 frame throws error", () => {
  expect(() => {
    animate3v([[6,7,8]])
  }).toThrowError(new Error("there must be at least 2 markers."));
});

test("animate3v with 2 frames with multiple MS interval from 0 to 1 sec", () => {
  const animator = animate3v([[1, 2, 3], [6, 7, 8]]);

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

test("animate3v with 2 frames with multiple MS interval from 0 to 1 sec in reverse", () => {
  const animator = animate3v([[1, 2, 3], [6, 7, 8]]);

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

test("animateScalar with 4 curve points and 10 second span with 1 millisecond at a time", () => {
  const animator = animateScalar([0, 1, 2, 3]);

  for (let i = -10000; i < 10000; i++) {
    // Tricky end of frame values. This is just reference to help illustrate
    // what values to expect and their relationship to each other.
    // 3000/1000  = 3    // 3/3   = 1  // 3 frame value
    // 6000/1000  = 6    // 6/3   = 2  // 3 frame value
    // 9000/1000  = 9    // 9/3   = 3  // 3 frame value
    // 12000/1000 = 12   // 12/3  = 4  // 3 frame value

    let actual = animator(i);
    let expected = Math.abs((i * 0.001)%3);
    // This adjustment is to ensure that we have the right value when
    // we are at the end of frame.
    expected = !expected && i ? 3 : expected;
    expected = normalizeDecimal(expected);

    // Because of floating point math "stuff" in javascript, multiplication
    // can yield bad results. For example
    // 9 * 0.001 yields 0.009000000000000001. But it really should be 0.009.
    // https://techformist.com/problems-with-decimal-multiplication-javascript/
    //
    // So we normalize the values to have the same decimal count to ensure
    // values do match.
    expect(normalizeDecimal(actual)).toEqual(normalizeDecimal(expected));
  }
});

test("animateScalar with 4 curve points and 10 second span with 1 millisecond at a time - in reverse", () => {
  const animator = animateScalar([0, 1, 2, 3]);
  const speed = -1;

  for (let i = -10000; i < 10000; i++) {
    let actual = animator(i, speed);
    let expected = Math.abs((i * 0.001)%3);
    // This adjustment is to ensure that we have the right value when
    // we are at the end of frame.
    expected = !expected && i ? 3 : expected;
    expected = normalizeDecimal(3 - expected);

    // Because of floating point math "stuff" in javascript, multiplication
    // can yield bad results. For example
    // 9 * 0.001 yields 0.009000000000000001. But it really should be 0.009.
    // https://techformist.com/problems-with-decimal-multiplication-javascript/
    //
    // So we normalize the values to have the same decimal count to ensure
    // values do match.
    expect(normalizeDecimal(actual)).toEqual(normalizeDecimal(expected));
  }
});

test("animateScalar with 4 curve points iterating over a 3 second span", () => {
  const animator = animateScalar([0, 1, 2, 3]);
  const speed = 1;

  expect(animator(0, speed)).toEqual(0);
  expect(animator(250, speed)).toEqual(0.25);
  expect(animator(500, speed)).toEqual(0.5);
  expect(animator(750, speed)).toEqual(0.75);
  expect(animator(1000, speed)).toEqual(1);
  expect(animator(1250, speed)).toEqual(1.25);
  expect(animator(1500, speed)).toEqual(1.5);
  expect(animator(1750, speed)).toEqual(1.75);
  expect(animator(2000, speed)).toEqual(2);
  expect(animator(2250, speed)).toEqual(2.25);
  expect(animator(2500, speed)).toEqual(2.5);
  expect(animator(2750, speed)).toEqual(2.75);
  expect(animator(3000, speed)).toEqual(3);
  expect(animator(3001, speed)).toEqual(0.001);
  expect(animator(3002, speed)).toEqual(0.002);
});

test("animateScalar with 4 curve points iterating over a 3 second span in reverse", () => {
  const animator = animateScalar([0, 1, 2, 3]);
  const speed = -1;

  expect(animator(0, speed)).toEqual(3);
  expect(animator(250, speed)).toEqual(2.75);
  expect(animator(500, speed)).toEqual(2.5);
  expect(animator(750, speed)).toEqual(2.25);
  expect(animator(1000, speed)).toEqual(2);
  expect(animator(1250, speed)).toEqual(1.75);
  expect(animator(1500, speed)).toEqual(1.5);
  expect(animator(1750, speed)).toEqual(1.25);
  expect(animator(2000, speed)).toEqual(1);
  expect(animator(2250, speed)).toEqual(0.75);
  expect(animator(2500, speed)).toEqual(0.5);
  expect(animator(2750, speed)).toEqual(0.25);
  expect(animator(3000, speed)).toEqual(0);
  expect(animator(3001, speed)).toEqual(2.999);
  expect(animator(3002, speed)).toEqual(2.998);
});


test("animateScalar with 10 items from 0 to 1 second", () => {
  const animator = animateScalar([
    0,
    0.6858710646629333,
    2.524005651473999,
    5.185185432434082,
    8.340192794799805,
    11.659809112548828,
    14.814814567565918,
    17.47599220275879,
    19.314130783081055,
    20
  ]);

  expect(animator(0)).toEqual(0);
  expect(animator(1000)).toEqual(0.6858710646629333);
  expect(animator(2000)).toEqual(2.524005651473999);
  expect(animator(3000)).toEqual(5.185185432434082);
  expect(animator(4000)).toEqual(8.340192794799805);
  expect(animator(5000)).toEqual(11.659809112548828);
  expect(animator(6000)).toEqual(14.814814567565918);
  expect(animator(7000)).toEqual(17.47599220275879,);
  expect(animator(8000)).toEqual(19.314130783081055);
  expect(animator(9000)).toEqual(20);
  expect(animator(10000)).toEqual(0.6858710646629333);
});

function normalizeDecimal(v) {
  return Number.parseFloat("" + v).toFixed(4);
}
