import {
  Matrix4,
  multiplyVector,
  transpose,
  multiply,
} from "./matrix4.js";

test("Identity has the correct values", () => {
  expect(Matrix4.identity().data).toEqual([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
});

test("Rotating 1 and then -1 results in the same matrix before rotation", () => {
  const mat4 = Matrix4.identity();
  const actual = mat4.rotate(-1, 0, 0).rotate(1, 0, 0);

  // TODO(miguel): fix negative zero values in matrix. Not urgent since
  // in practice -0 and 0 mean the same thing in JS math; different
  // numbers but generate the same results in practice.
  expect(mat4.data).toEqual(actual.data.map(n => n === -0 ? 0 : n));
});

test("Multiply two 4x4 matrices", () => {
  const a = [
    5,   7,  9,  10,
    2,   3,  3,   8,
    8,  10,  2,   3,
    3,   3,  4,   8,
  ];

  const b = [
    3,  10, 12, 18,
   12,   1,  4,  9,
    9,  10, 12,  2,
    3,  12,  4, 10,
  ];

  expect(multiply(b, a)).toEqual([
    210, 267, 236, 271,
     93, 149, 104, 149,
    171, 146, 172, 268,
    105, 169, 128, 169,
  ]);
});

test("Matrix translation", () => {
  const identity = Matrix4.identity();
  const a = new Matrix4([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    1, 2, 3, 1,
  ]);

  let b = identity;
  // Identity matrix multiplication results in the same matrix.
  expect(a.multiply(b).data).toEqual(a.data);
  expect(b.multiply(a).data).toEqual(a.data);

  b = b.rotate(90, 0, 0);

  // translation with 90 degree rotation
  expect(a.multiply(b).data).toEqual([
    1,  0, 0, 0,
    0,  0, 1, 0,
    0, -1, 0, 0,
    1,  2, 3, 1,
  ]);

  // translation with 180 degree rotation
  expect(a.multiply(b).multiply(b).data).toEqual([
    1,  0,  0, 0,
    0, -1,  0, 0,
    0,  0, -1, 0,
    1,  2,  3, 1,
  ]);

  // Same as above but matrix steps are explicit rather
  // then accumulated over the course of multiple transformations.
  expect(identity.translate(1,2,3).rotate(180, 0, 0).data.map(_fixZeros)).toEqual([
    1,  0,  0, 0,
    0, -1,  0, 0,
    0,  0, -1, 0,
    1,  2,  3, 1,
  ]);

  // translation then 90 degree rotation
  expect(b.multiply(a).data).toEqual([
    1,  0,  0, 0,
    0,  0,  1, 0,
    0, -1,  0, 0,
    1, -3,  2, 1,
  ]);

  // 2 translations then 90 degree rotation
  expect(b.multiply(a).multiply(a).data).toEqual([
    1,  0, 0, 0,
    0,  0, 1, 0,
    0, -1, 0, 0,
    2, -6, 4, 1,
  ]);
});

test("Multiply vector times 4x4 matrices", () => {
  const a = [
    5,   7,  9,  10,
    2,   3,  3,   8,
    8,  10,  2,   3,
    3,   3,  4,   8,
  ];

  expect(multiplyVector(a, [ 3, 12,  9,  3])).toEqual([210,  93, 171, 105]);
  expect(multiplyVector(a, [10,  1, 10, 12])).toEqual([267, 149, 146, 169]);
  expect(multiplyVector(a, [12,  4, 12,  4])).toEqual([236, 104, 172, 128]);
  expect(multiplyVector(a, [18,  9,  2, 10])).toEqual([271, 149, 268, 169]);
});

test("Transpose 4x4 matrix", () => {
  const a = [
    5,   7,  9,  10,
    2,   3,  3,   8,
    8,  10,  2,   3,
    3,   3,  4,   8,
  ];

  expect(transpose(a)).toEqual([
     5, 2,  8, 3,
     7, 3, 10, 3,
     9, 3,  2, 4,
    10, 8,  3, 8,
  ]);
});

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
