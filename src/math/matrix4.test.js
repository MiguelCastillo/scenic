import {
  Matrix4,
  multiplyVector,
  transpose,
  multiply,
  invert,
  adjoint,
  determinant,
} from "./matrix4.js";
import {matrixFloatPrecision} from "./float.js";

test("Identity has the correct values", () => {
  expect(Matrix4.identity().data).toEqual([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
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

  expect(multiply([], a, b)).toEqual([
    210, 267, 236, 271,
     93, 149, 104, 149,
    171, 146, 172, 268,
    105, 169, 128, 169,
  ]);
});

describe("rotation", () => {
  test("Rotating 1 and then -1 results in the same matrix before rotation", () => {
    const m = Matrix4.identity();
    const actual = m.rotate(-1, 0, 0).rotate(1, 0, 0);
    expect(m.data).toEqual(actual.data);
  });

  test("rotate and multiply from FBX animation", () => {
    const a = new Matrix4([
      6, 0, 0, 3,
      0, 6.000000638552494, 0, 0,
      0, 0, 6.000000638552494, 0,
      0, 0, 0, 1,
    ]);

    const b = Matrix4.identity()
      .translate(0,1,0)
      .rotate(90, 90, 0)
      .scale(0.9999997615814209, 1, 0.9999997615814209);

    const expected = a.multiply(b).data;
    expect(expected).toEqual([
      0, 6, 0, 3,
      0, 0, -6, 6,
      -6, 0, 0, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate XYZ", () => {
    // ROLL 60
    // PITCH 30
    // YAW 45
    const expected = Matrix4.rotation(60, 30, 45).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0.61237, -0.04737, 0.78915, 0,
      0.61237, 0.65974, -0.4356, 0,
      -0.5, 0.75, 0.43301, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 90 on X", () => {
    // ROLL
    const expected = Matrix4.rotation(90, 0, 0).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      1, 0, 0, 0,
      0, 0, -1, 0,
      0, 1, 0, 0,
      0, 0, 0, 1
    ]);
  });

  test("rotate 90 on Y", () => {
    // PITCH
    const expected = Matrix4.rotation(0, 90, 0).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0, 0, 1, 0,
      0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 90 on Z", () => {
    // YAW
    const expected = Matrix4.rotation(0, 0, 90).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0, -1, 0, 0,
      1, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 45 on X", () => {
    // ROLL
    const expected = Matrix4.rotation(45, 0, 0).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      1, 0, 0, 0,
      0, 0.70711, -0.70711, 0,
      0, 0.70711, 0.70711, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 45 on Y", () => {
    // PITCH
    const expected = Matrix4.rotation(0, 45, 0).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0.70711, 0, 0.70711, 0,
      0, 1, 0, 0,
      -0.70711, 0, 0.70711, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 45 on Z", () => {
    // YAW
    const expected = Matrix4.rotation(0, 0, 45).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0.70711, -0.70711, 0, 0,
      0.70711, 0.70711, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 45 on XY", () => {
    // ROLL & PITCH
    const expected = Matrix4.rotation(45, 45, 0).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0.70711, 0.5, 0.5, 0,
      0, 0.70711, -0.70711, 0,
      -0.70711, 0.5, 0.5, 0,
      0, 0, 0, 1,
    ]);
  });

  test("rotate 45 on XYZ", () => {
    // ROLL & PITCH & YAW
    const expected = Matrix4.rotation(45, 45, 45).data;
    expect(expected).toEqual([
      // Rotation Tait–Bryan angles XYZ
      0.5, -0.14645, 0.85355, 0,
      0.5, 0.85355, -0.14645, 0,
      -0.70711, 0.5, 0.5, 0,
      0, 0, 0, 1,
    ]);
  });
});

describe("identity", () => {
  test("translation multiplication should stay unchanged", () => {
    const identity = Matrix4.identity();
    const a = identity.translate(1, 2, 3);

    expect(a.multiply(identity).data).toEqual(a.data);
    expect(identity.multiply(a).data).toEqual(a.data);
  });

  test("rotation multiplication should stay unchanged", () => {
    const identity = Matrix4.identity();
    const a = identity.rotate(60, 45, 30);

    expect(a.multiply(identity).data).toEqual(a.data);
    expect(identity.multiply(a).data).toEqual(a.data);
  });

  test("scaling multiplication should stay unchanged", () => {
    const identity = Matrix4.identity();
    const a = identity.scale(2, 2, 2);

    expect(a.multiply(identity).data).toEqual(a.data);
    expect(identity.multiply(a).data).toEqual(a.data);
  });
});

test("translation and rotation", () => {
  const identity = Matrix4.identity();
  const a = identity.translate(1, 2, 3);
  const b = identity.rotate(90, 0, 0);

  // translation with 90 degree rotation
  let expected = a.multiply(b).data;
  expect(expected).toEqual([
    1, 0,  0, 1,
    0, 0, -1, 2,
    0, 1,  0, 3,
    0, 0,  0, 1,
  ]);

  // translation with 180 degree rotation
  expected = a.multiply(b).multiply(b).data;
  expect(expected).toEqual([
    1,  0,  0, 1,
    0, -1,  0, 2,
    0,  0, -1, 3,
    0,  0,  0, 1,
  ]);

  // Same as above but matrix steps are explicit rather
  // then accumulated over the course of multiple transformations.
  expected = identity.translate(1,2,3).rotate(180, 0, 0).data;
  expect(expected).toEqual([
    1,  0,  0, 1,
    0, -1,  0, 2,
    0,  0, -1, 3,
    0,  0,  0, 1,
  ]);

  // translation then 90 degree rotation
  expected = b.multiply(a).data;
  expect(expected).toEqual([
    1, 0, 0, 1,
    0, 0, -1, -3,
    0, 1, 0, 2,
    0, 0, 0, 1
  ]);

  // 2 translations then 90 degree rotation
  expected = b.multiply(a).multiply(a).data;
  expect(expected).toEqual([
    1, 0, 0, 2,
    0, 0, -1, -6,
    0, 1, 0, 4,
    0, 0, 0, 1,
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

test("adjoint", () => {
  expect(adjoint([], [
    1, 1, 1, -1,
    1, 1, -1, 1,
    1, -1, 1, 1,
    -1, 1, 1, 1,
  ])).toEqual([
    -4, -4, -4, 4,
    -4, -4, 4, -4,
    -4, 4, -4, -4,
    4, -4, -4, -4,
  ]);
});

test("determinant is -16", () => {
  expect(determinant([
    1, 1, 1, -1,
    1, 1, -1, 1,
    1, -1, 1, 1,
    -1, 1, 1, 1,
  ])).toEqual(-16);
});

test("invert", () => {
  expect(
    invert([], [
      2, 1, 2, 1,
      3, 2, 3, 1,
      1, 4, 2, 1,
      1, 3, 2, 1,
    ]).map(_fixZeros)
  ).toEqual([
    1, 0, 2, -3,
    0, 0, 1, -1,
    -2, 1, -3, 4,
    3, -2, 1, -1,
  ]);

  expect(
    invert([], [
      1, 2, -1, 7,
      -3, 1, 1, 2,
      1, -5, 2, 1,
      3, 3, 2, 1,
    ]).map(matrixFloatPrecision).map(_fixZeros)
  ).toEqual([
    0.04255, -0.21277, 0.03191, 0.09574,
    -0.01064, 0.05319, -0.13298, 0.10106,
    -0.10993, 0.21631, 0.12589, 0.21099,
    0.12411, 0.0461, 0.05142, -0.01241,
  ]);
});

describe("invert", () => {
  test("matrix rotated on X", () => {
    const R = Matrix4.rotation(13, 0, 0);
    expect(R.invert().multiply(R).data).toEqual(Matrix4.identity().data);
  });

  test("matrix rotated on Y", () => {
    const R = Matrix4.rotation(0, 13, 0);
    expect(R.invert().multiply(R).data).toEqual(Matrix4.identity().data);
  });

  test("matrix rotated on Z", () => {
    const R = Matrix4.rotation(0, 0, 13);
    expect(R.invert().multiply(R).data).toEqual(Matrix4.identity().data);
  });

  test("matrix with translation", () => {
    const T = Matrix4.translation(10, 15, 20);
    expect(T.invert().multiply(T).data).toEqual(Matrix4.identity().data);
  });

  test("matrix with rotation and translation", () => {
    const transform = Matrix4
      .translation(10, 15, 20)
      .rotation(13, 0, 0);

    expect(
      transform.multiplyInverse(transform).data,
    ).toEqual(Matrix4.identity().data);

    expect(
      transform.invert().multiply(transform).data.map(Math.round),
    ).toEqual(Matrix4.identity().data);
  });

  test("lots of transformations", () => {
    const transform = Matrix4
      .translation(10, 15, 20)
      .rotation(0, 90, 0);

    // This illustrates an important aspect of rotation matrices.
    // When we translate 2 units on the X axis, the translation
    // occurs on the rotated object along the Y axis.
    // So the final result for the position isn't 10+2 = 12 units
    // on the X axis. It is 2 units on the object that rotated so
    // the translation occurs in that direction.
    // The highlight here is that transformations are cumulative.
    const transform2 = transform
      .translate(2, 0, 0)
      .rotate(0, 90, 0);

    let expected = transform2.data;
    expect(expected).toEqual([
      -1, 0, 0, 10,
      0, 1, 0, 15,
      0, 0, -1, 18,
      0, 0, 0, 1,
    ]);

    // This inverse multiplication clears the original transformaion
    // only leaving behind the last translation and rotation
    expected = transform.multiplyInverse(transform2).data;
    expect(expected).toEqual([
      0, 0, 1, 2,
      0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 0, 1,
    ]);

    // Inverting here means that we undo all the things in transform
    // and only leave the things from transform2.
    expected = transform.multiplyInverse(transform2.translate(2, 0, 2).scale(2, 2, 2)).data;
    expect(expected).toEqual([
      0, 0, 2, 4,
      0, 2, 0, 0,
      -2, 0, 0, -2,
      0, 0, 0, 1
    ]);

    expected = transform2.multiplyInverse(transform).data;
    expect(expected).toEqual([
      0, 0, -1, 0,
      0, 1, 0, 0,
      1, 0, 0, -2,
      0, 0, 0, 1,
    ]);
  });
});

describe("determinant X", () => {
  test("for rotation should be 49", () => {
    expect(determinant([
      2, -3, 1, 0,
      2, 0, -1, 0,
      1, 4, 5, 0,
      0, 0, 0, 1,
    ])).toEqual(49);
  });

  test("for rotation should be (-15)", () => {
    expect(determinant([
      1, 3, 2, 0,
      -3, -1, -3, 0,
      2, 3, 1, 0,
      0, 0, 0, 1,
    ])).toEqual(-15);
  });

  test("for rotation should be (-40)", () => {
    expect(determinant([
      -5, 0, -1, 0,
      1, 2, -1, 0,
      -3, 4, 1, 0,
      0, 0, 0, 1,
    ])).toEqual(-40);
  });
});

test("Rotation Adjoint",  () => {
  expect(adjoint([], [
    2, -1, 3, 0,
    0, 5, 2, 0,
    1, -1, -2, 0,
    0, 0, 0, 1,
  ]).map(_fixZeros)).toEqual([
    -8, -5, -17, 0,
    2, -7, -4, 0,
    -5, 1, 10, 0,
    0, 0, 0, -33,
  ]);
});

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
