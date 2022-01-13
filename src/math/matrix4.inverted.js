// https://www.khanacademy.org/math/linear-algebra/matrix-transformations#lin-trans-examples
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection

import {sin, cos} from "./angles.js";
import {matrixFloatPrecision} from "./float.js";

export class Matrix4 {
  constructor(data) {
    if (!data) {
      return Matrix4.identity();
    }

    if (data instanceof Matrix4) {
      this.data = data.data.slice();
    } else {
      this.data = data.map(matrixFloatPrecision);
    }
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
    data[_03] = this.data[_03];
    data[_13] = this.data[_13];
    data[_23] = this.data[_23];
    return new Matrix4(data);
  }

  translation(tx, ty, tz) {
    const data = this.data.slice();
    data[_03] = tx;
    data[_13] = ty;
    data[_23] = tz;
    return new Matrix4(data);
  }

  transpose() {
    return new Matrix4(transpose(this.data));
  }

  scaling(sx, sy, sz) {
    const data = this.data.slice();
    data[_00] = sx;
    data[_11] = sy;
    data[_22] = sz;
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
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1,
  ];
};

export function rotateY(degrees) {
  const c = cos(degrees);
  const s = sin(degrees);

  return [
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1,
  ];
};

export function rotateZ(degrees) {
  const c = cos(degrees);
  const s = sin(degrees);

  return [
     c, -s, 0, 0,
     s, c, 0, 0,
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

  return [
    a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30,
    a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31,
    a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32,
    a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,

    a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30,
    a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31,
    a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32,
    a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33,

    a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30,
    a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31,
    a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32,
    a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33,

    a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30,
    a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31,
    a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32,
    a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33,
  ];
}

// multiplyVector multiplies a 4x4 matrix A time a vector x.
//
// a11 a12 a13 a14 | x1
// a21 a22 a23 a24 | x2
// a31 a32 a33 a34 | x3
// a41 a42 a43 a44 | x4
export function multiplyVector(a, vec4) {
  return [
    a[_00] * vec4[0] + a[_01] * vec4[1] + a[_02] * vec4[2] + a[_03] * vec4[3],
    a[_10] * vec4[0] + a[_11] * vec4[1] + a[_12] * vec4[2] + a[_13] * vec4[3],
    a[_20] * vec4[0] + a[_21] * vec4[1] + a[_22] * vec4[2] + a[_23] * vec4[3],
    a[_30] * vec4[0] + a[_31] * vec4[1] + a[_32] * vec4[2] + a[_33] * vec4[3],
  ];
}

export function transpose(a) {
  return [
    a[_00], a[_10], a[_20], a[_30],
    a[_01], a[_11], a[_21], a[_31],
    a[_02], a[_12], a[_22], a[_32],
    a[_03], a[_13], a[_23], a[_33], 
  ];
}

// Multiply multiple matrices, one after the other to compound transformations.
// One good use case for this is when we have to rotate multiple axis where we
// apply one rotation at a time on each axis.
// You can call this as `multiplyMany(m1, m2, m3)` and that will return a
// single matrix by multiplying `mult(mult(m1, m2), m3)`.
export function multiplyMany(...matrices) {
  return matrices.reduce(multiply);
}

// Matrix indexes for Row by Column (RxC) where the first digit is the
// row index and the decond digit is the column index.
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
