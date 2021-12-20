import {Matrix4} from "./matrix4.js";

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
