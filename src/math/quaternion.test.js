import {
  fromEulerAngles,
  toEulerAngle,
  toRotationMatrix,
} from "./quaternion.js";

import {fixed5f, matrixFloatPrecision} from "./float.js";
import * as mat4 from "./matrix4.js";

describe("fromEulerAngles", () => {
  test("rotate XYZ", () => {
    // ROLL 60
    // PITCH 30
    // YAW 45
    const expected = fromEulerAngles([], 60, 30, 45).map(correctFloat);
    expect(expected).toEqual([0.82236, 0.36042, 0.3919, 0.20056]);
  });

  test("180 on X", () => {
    const expected = fromEulerAngles([], 180, 0, 0).map(correctFloat);
    expect(expected).toEqual([0, 1, 0, 0]);
  });

  test("180 on Y", () => {
    const expected = fromEulerAngles([], 0, 180, 0).map(correctFloat);
    expect(expected).toEqual([0, 0, 1, 0]);
  });

  test("180 on Z", () => {
    const expected = fromEulerAngles([], 0, 0, 180).map(correctFloat);
    expect(expected).toEqual([0, 0, 0, 1]);
  });

  test("90 on X", () => {
    const expected = fromEulerAngles([], 90, 0, 0).map(correctFloat);
    expect(expected).toEqual([0.70711, 0.70711, 0, 0]);
  });

  test("90 on Y", () => {
    const expected = fromEulerAngles([], 0, 90, 0).map(correctFloat);
    expect(expected).toEqual([0.70711, 0, 0.70711, 0]);
  });

  test("90 on Z", () => {
    const expected = fromEulerAngles([], 0, 0, 90).map(correctFloat);
    expect(expected).toEqual([0.70711, 0, 0, 0.70711]);
  });

  test("90 on XY", () => {
    const expected = fromEulerAngles([], 90, 90, 0).map(correctFloat);
    expect(expected).toEqual([0.5, 0.5, 0.5, -0.5]);
  });

  test("90 on XZ", () => {
    const expected = fromEulerAngles([], 90, 0, 90).map(correctFloat);
    expect(expected).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  test("90 on YZ", () => {
    const expected = fromEulerAngles([], 0, 90, 90).map(correctFloat);
    expect(expected).toEqual([0.5, -0.5, 0.5, 0.5]);
  });

  test("60 on X", () => {
    const expected = fromEulerAngles([], 60, 0, 0).map(correctFloat);
    expect(expected).toEqual([0.86603, 0.5, 0, 0]);
  });

  test("60 on Y", () => {
    const expected = fromEulerAngles([], 0, 60, 0).map(correctFloat);
    expect(expected).toEqual([0.86603, 0, 0.5, 0]);
  });

  test("60 on Z", () => {
    const expected = fromEulerAngles([], 0, 0, 60).map(correctFloat);
    expect(expected).toEqual([0.86603, 0, 0, 0.5]);
  });

  test("45 on X", () => {
    const expected = fromEulerAngles([], 45, 0, 0).map(correctFloat);
    expect(expected).toEqual([0.92388, 0.38268, 0, 0]);
  });

  test("45 on Y", () => {
    const expected = fromEulerAngles([], 0, 45, 0).map(correctFloat);
    expect(expected).toEqual([0.92388, 0, 0.38268, 0]);
  });

  test("45 on Z", () => {
    const expected = fromEulerAngles([], 0, 0, 45).map(correctFloat);
    expect(expected).toEqual([0.92388, 0, 0, 0.38268]);
  });
});

// Quternion rotations are in ZYX order by default and when converting to
// euler angles, they are converted as ZYX as well. So when creating a
// quaternion with euler [90, 0, 90] and converting back to euler, the
// angles are not [90, 0, 90].
describe("toEulerAngle", () => {
  test("rotate XYZ", () => {
    // ROLL 60
    // PITCH 30
    // YAW 45
    const q = fromEulerAngles([], 60, 30, 45).map(fixed5f);
    expect(q).toEqual([0.82236, 0.36042, 0.3919, 0.20056]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([60, 30, 45]);
  });

  test("90 on X", () => {
    const q = fromEulerAngles([], 90, 0, 0).map(fixed5f);
    expect(q).toEqual([0.70711, 0.70711, 0, 0]);

    const expected = toEulerAngle([], [0.70711, 0.70711, 0, 0]).map(Math.round);
    expect(expected).toEqual([90, 0, 0]);
  });

  test("90 on Y", () => {
    const q = fromEulerAngles([], 0, 90, 0).map(fixed5f);
    expect(q).toEqual([0.70711, 0, 0.70711, 0]);

    const expected = toEulerAngle([], q).map(Math.round).map(_fixZeros);
    expect(expected).toEqual([0, 90, 0]);
  });

  test("90 on Z", () => {
    const q = fromEulerAngles([], 0, 0, 90).map(fixed5f);
    expect(q).toEqual([0.70711, 0, 0, 0.70711]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([0, 0, 90]);
  });

  test("90 on XY", () => {
    const q = fromEulerAngles([], 90, 90, 0).map(fixed5f);
    expect(q).toEqual([0.5, 0.5, 0.5, -0.5]);

    // This is confusing - but it is not incorrect that converting the q angles
    // back to euler give different angles. It's euler angles are coming out
    // in ZYX order. To match correctly, we would want XYZ order.
    // You can test with the site below and set ZYX angles in the input euler
    // and the output euler and they will match.
    // https://www.andre-gaschler.com/rotationconverter/
    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([0, 90, -90]);
  });

  test("90.01 on XY", () => {
    const q = fromEulerAngles([], 90.1, 90.1, 0).map(fixed5f);
    expect(q).toEqual([0.49913, 0.5, 0.5, -0.50087]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([0, 90, -90]);
  });

  test("89.99 on XY", () => {
    const q = fromEulerAngles([], 89.99, 89.99, 0).map(fixed5f);
    expect(q).toEqual([0.50009, 0.5, 0.5, -0.49991]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([0, 90, -90]);
  });

  test("90 on XZ", () => {
    const q = fromEulerAngles([], 90, 0, 90).map(fixed5f);
    expect(q).toEqual([0.5, 0.5, 0.5, 0.5]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([90, 0, 90]);
  });

  test("90 on YZ", () => {
    const q = fromEulerAngles([], 0, 90, 90).map(fixed5f);
    expect(q).toEqual([0.5, -0.5, 0.5, 0.5]);

    const expected = toEulerAngle([], q).map(Math.round);
    expect(expected).toEqual([0, 90, 90]);
  });

  test("60 on X", () => {
    const expected = toEulerAngle([], [0.86603, 0.5, 0, 0]).map(Math.round);
    expect(expected).toEqual([60, 0, 0]);
  });

  test("60 on Y", () => {
    const expected = toEulerAngle([], [0.86603, 0, 0.5, 0]).map(Math.round);
    expect(expected).toEqual([0, 60, 0]);
  });

  test("60 on Z", () => {
    const expected = toEulerAngle([], [0.86603, 0, 0, 0.5]).map(Math.round);
    expect(expected).toEqual([0, 0, 60]);
  });

  it("45 on X", () => {
    let expected = toEulerAngle([], [0.9238, 0.3826, 0, 0]).map(Math.round);
    expect(expected).toEqual([45, 0, 0]);
  });

  it("45 on Y", () => {
    let expected = toEulerAngle([], [0.9238, 0, 0.3826, 0]).map(Math.round);
    expect(expected).toEqual([0, 45, 0]);
  });

  it("45 on Z", () => {
    let expected = toEulerAngle([], [0.9238, 0, 0, 0.3826]).map(Math.round);
    expect(expected).toEqual([0, 0, 45]);
  });
});

describe("toRotationMatrix", () => {
  it("45 on X", () => {
    const q = fromEulerAngles([], 45, 0, 0).map(fixed5f);
    expect(q).toEqual([0.92388, 0.38268, 0, 0]);

    let expected = toRotationMatrix(mat4.identity(), q).map(fixed5f);
    expect(expected).toEqual([
      1, 0, 0, 0,
      0, 0.70711, -0.7071, 0,
      0, 0.7071, 0.70711, 0,
      0, 0, 0, 1,
    ]);
  });

  it("45 on Y", () => {
    const q = fromEulerAngles([], 0, 45, 0).map(fixed5f);
    expect(q).toEqual([0.92388, 0, 0.38268, 0]);

    let expected = toRotationMatrix(mat4.identity(), q).map(fixed5f);
    expect(expected).toEqual([
      0.70711, 0, 0.7071, 0,
      0, 1, 0, 0,
      -0.7071, 0, 0.70711, 0,
      0, 0, 0, 1,
    ]);
  });

  it("45 on Z", () => {
    const q = fromEulerAngles([], 0, 0, 45).map(fixed5f);
    expect(q).toEqual([0.92388, 0, 0, 0.38268]);

    let expected = toRotationMatrix(mat4.identity(), q).map(fixed5f);
    expect(expected).toEqual([
      0.70711, -0.7071, 0, 0,
      0.7071, 0.70711, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });
});

function correctFloat(v) {
  return _fixZeros(matrixFloatPrecision(v));
}
function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
