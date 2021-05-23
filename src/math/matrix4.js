// https://www.khanacademy.org/math/linear-algebra/matrix-transformations#lin-trans-examples

import {sin, cos} from "./angles.js";
import {matrixFloatPrecision} from "./float.js";

export class Matrix4 {
  constructor(data) {
    if (!data) {
      return Matrix4.identity();
    }

    this.data = data.map(matrixFloatPrecision);
  }

  static identity() {
    return new Matrix4(identity());
  }

  static rotation(degreesX, degreesY, degreesZ) {
    return new Matrix4(rotate(degreesX, degreesY, degreesZ));
  }

  static translation(tx, ty, tz) {
    return new Matrix4(translate(tx, ty, tz));
  }

  static scale(sx, sy, sz) {
    return new Matrix4(scale(sx, sy, sz));
  }

  rotateX(degrees) {
    return new Matrix4(
      multiply(this.data, rotateX(degrees))
    );
  }

  rotateY(degrees) {
    return new Matrix4(
      multiply(this.data, rotateY(degrees))
    );
  }

  rotateZ(degrees) {
    return new Matrix4(
      multiply(this.data, rotateZ(degrees))
    );
  }

  rotate(degreesX, degreesY, degreesZ) {
    return new Matrix4(
      multiply(this.data, rotate(degreesX, degreesY, degreesZ))
    );
  }

  scale(sx, sy, sz) {
    return new Matrix4(
      multiply(this.data, scale(sx, sy, sz))
    );
  }

  translate(tx, ty, tz) {
    return new Matrix4(
      multiply(this.data, translate(tx, ty, tz))
    );
  }

  multiply(mat4) {
    return new Matrix4(
      multiply(this.data, mat4.data)
    );
  }

  rotation(degreesX, degreesY, degreesZ) {
    const data = rotate(degreesX, degreesY, degreesZ);
    data[_30] = this.data[_30];
    data[_31] = this.data[_31];
    data[_32] = this.data[_32];
    return new Matrix4(data);
  }

  translation(tx, ty, tz) {
    const data = this.data.slice();
    data[_30] = tx;
    data[_31] = ty;
    data[_32] = tz;
    return new Matrix4(data);
  }
};

export function identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

// TODO(miguel): use quaternions instead of rotating one axis at a time.
export function rotate(degreesX, degreesY, degreesZ) {
  // return multiply(multiply(rotateX(degreesX), rotateY(degreesY)), rotateZ(degreesZ));
  return multiplyMany(rotateX(degreesX), rotateY(degreesY), rotateZ(degreesZ));
}

export function rotateX(degrees) {
  const c = cos(degrees);
  const s = sin(degrees);

  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ];
};

export function rotateY(degrees) {
  const c = cos(degrees);
  const s = sin(degrees);

  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ];
};

export function rotateZ(degrees) {
  const c = cos(degrees);
  const s = sin(degrees);

  return [
     c, s, 0, 0,
    -s, c, 0, 0,
     0, 0, 1, 0,
     0, 0, 0, 1,
  ];
};

export function translate(tx, ty, tz) {
  return [
    1,  0,  0,  0,
    0,  1,  0,  0,
    0,  0,  1,  0,
    tx, ty, tz, 1,
  ];
};

export function scale(sx, sy=sx, sz=sx) {
  return [
    sx, 0,  0,  0,
    0, sy,  0,  0,
    0,  0, sz,  0,
    0,  0,  0,  1,
  ];
}

export function multiply(a, b) {
  const a00 = a[_00]; const b00 = b[_00];
  const a01 = a[_01]; const b01 = b[_01];
  const a02 = a[_02]; const b02 = b[_02];
  const a03 = a[_03]; const b03 = b[_03];
  const a10 = a[_10]; const b10 = b[_10];
  const a11 = a[_11]; const b11 = b[_11];
  const a12 = a[_12]; const b12 = b[_12];
  const a13 = a[_13]; const b13 = b[_13];
  const a20 = a[_20]; const b20 = b[_20];
  const a21 = a[_21]; const b21 = b[_21];
  const a22 = a[_22]; const b22 = b[_22];
  const a23 = a[_23]; const b23 = b[_23];
  const a30 = a[_30]; const b30 = b[_30];
  const a31 = a[_31]; const b31 = b[_31];
  const a32 = a[_32]; const b32 = b[_32];
  const a33 = a[_33]; const b33 = b[_33];

  // The multiplication here is transpose of A _times_ transpose of B.
  // This is to take into account the fact that matrix columns are stored with
  // sequental indexes in the array to make it simpler for webgl to process
  // translation in the last row with sequential indexes. However, it is more
  // common in mathematics to represent translation as the last column rather
  // then the last row as we do here. But that makes it a lil more tricky to
  // read out of the array translation coordinates, since the indexes are no
  // longer sequential.
  return [
    // First row = first row of B times all columns of A
    b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
    b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
    b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
    b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,

    // Second row = second row of B times all columns of A
    b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
    b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
    b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
    b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,

    // Thrid row = third row of B times all columns of A
    b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
    b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
    b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
    b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,

    // Fourth row = fourth row of B times all columns of A
    b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
    b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
    b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
    b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
  ];
};

// Multiply multiple matrices, one after the other to compound transformations.
// One good use case for this is when we have to rotate multiple axis where we
// apply one rotation at a time on each axis.
// You can call this as `multiplyMany(m1, m2, m3)` and that will return a
// single matrix by multiplying `mult(mult(m1, m2), m3)`.
export function multiplyMany(...matrices) {
  return matrices.reduce(multiply);
}

// Matrix indexes.
// 00 01 02 03
// 10 11 12 13
// 20 21 22 23
// 30 31 32 33
//
// Scale is 00, 11, 22.
//
// Translation is 30, 31, 32.
//
// Rotation along X:
// 11(cos)  12(sin)
// 21(-sin) 22(cos)
//
// Rotation along Y:
// 00(cos) 02(-sin)
// 20(sin) 22(cos)
//
// Rotation along Z:
// 00(cos)  01(sin)
// 10(-sin) 11(cos)
const _00 = 0;  const _01 = 1;  const _02 = 2;  const _03 = 3;
const _10 = 4;  const _11 = 5;  const _12 = 6;  const _13 = 7;
const _20 = 8;  const _21 = 9;  const _22 = 10; const _23 = 11;
const _30 = 12; const _31 = 13; const _32 = 14; const _33 = 15;
