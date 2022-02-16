// https://www.khanacademy.org/math/linear-algebra/matrix-transformations#lin-trans-examples

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

  scaling(sx, sy, sz) {
    const data = this.data.slice();
    data[_00] = sx;
    data[_11] = sy;
    data[_22] = sz;
    return new Matrix4(data);
  }

  transpose() {
    return new Matrix4(transpose(this.data));
  }

  invert() {
    return new Matrix4(invert([], this.data));
  }

  multiplyInverse(m) {
    return new Matrix4(multiply(
      invert([], this.data),
      m.data));
  }

  equal(m) {
    return this.data.every((d, i) => d === m.data[i]);
  }
};

// https://www.chilimath.com/lessons/advanced-algebra/determinant-3x3-matrix/
// https://semath.info/src/inverse-cofactor-ex4.html
// https://www.mathsisfun.com/algebra/matrix-inverse.html
export function invert(dest, data) {
  adjoint(dest, data);
  const factor = 1/determinant(data);

  dest[0] *= factor;
  dest[1] *= factor;
  dest[2] *= factor;
  dest[3] *= factor;
  dest[4] *= factor;
  dest[5] *= factor;
  dest[6] *= factor;
  dest[7] *= factor;
  dest[8] *= factor;
  dest[9] *= factor;
  dest[10] *= factor;
  dest[11] *= factor;
  dest[12] *= factor;
  dest[13] *= factor;
  dest[14] *= factor;
  dest[15] *= factor;
  return dest;
}

export function adjoint(dest, data) {
  const a11 = data[_00], a12 = data[_01], a13 = data[_02], a14 = data[_03];
  const a21 = data[_10], a22 = data[_11], a23 = data[_12], a24 = data[_13];
  const a31 = data[_20], a32 = data[_21], a33 = data[_22], a34 = data[_23];
  const a41 = data[_30], a42 = data[_31], a43 = data[_32], a44 = data[_33];

  const x1 = a33*a44;
  const x2 = a34*a42;
  const x3 = a32*a43;
  const x4 = a33*a42;
  const x5 = a32*a44;
  const x6 = a34*a43;
  const x7 = a12*a23
  const x8 = a13*a24;
  const x9 = a14*a22;
  const x10 = a14*a23;
  const x11 = a13*a22;
  const x12 = a12*a24;
  const x13 = a34*a41;
  const x14 = a31*a43;
  const x15 = a33*a41;
  const x16 = a31*a44;
  const x17 = a11*a23;
  const x18 = a14*a21;
  const x19 = a13*a21;
  const x20 = a11*a24;
  const x21 = a31*a42;
  const x22 = a32*a41;
  const x23 = a12*a21;
  const x24 = a11*a22;

  dest[0] = a22*(x1 - x6) + a23*(x2 - x5) + a24*(x3 - x4);
  dest[1] = a14*(x4 - x3) + a13*(x5 - x2) + a12*(x6 - x1);
  dest[2] = a44*(x7 - x11) + a42*(x8 - x10) + a43*(x9 - x12);
  dest[3] = a32*(x10 - x8) + a34*(x11 - x7) + a33*(x12 - x9);
  dest[4] = a24*(x15 - x14) + a23*(x16 - x13) + a21*(x6 - x1);
  dest[5] = a11*(x1 - x6) + a13*(x13 - x16) + a14*(x14 - x15);
  dest[6] = a41*(x10 - x8) + a44*(x19 - x17) + a43*(x20 - x18);
  dest[7] = a34*(x17 - x19) + a31*(x8 - x10) + a33*(x18 - x20);
  dest[8] = a21*(x5 - x2) + a22*(x13 - x16) + a24*(x21 - x22);
  dest[9] = a14*(x22 - x21) + a12*(x16 - x13) + a11*(x2 - x5);
  dest[10] = a44*(x24 - x23) + a41*(x12 - x9) + a42*(x18 - x20);
  dest[11] = a31*(x9 - x12) + a34*(x23 - x24) + a32*(x20 - x18);
  dest[12] = a23*(x22 - x21) + a22*(x14 - x15) + a21*(x4 - x3);
  dest[13] = a11*(x3 - x4) + a12*(x15 - x14) + a13*(x21 - x22);
  dest[14] = a41*(x11 - x7) + a43*(x23 - x24) + a42*(x17 - x19);
  dest[15] = a33*(x24 - x23) + a31*(x7 - x11) + a32*(x19 - x17);
  return dest;
}

export function determinant(data) {
  const a11 = data[_00], a12 = data[_01], a13 = data[_02], a14 = data[_03];
  const a21 = data[_10], a22 = data[_11], a23 = data[_12], a24 = data[_13];
  const a31 = data[_20], a32 = data[_21], a33 = data[_22], a34 = data[_23];
  const a41 = data[_30], a42 = data[_31], a43 = data[_32], a44 = data[_33];

  const x1 = a33*a44;
  const x2 = a34*a42;
  const x3 = a32*a43;
  const x4 = a33*a42;
  const x5 = a32*a44;
  const x6 = a34*a43;
  const x7 = a12*a23
  const x8 = a13*a24;
  const x9 = a14*a22;
  const x10 = a14*a23;
  const x11 = a13*a22;
  const x12 = a12*a24;

  let d11 = a22*(x1 - x6) + a23*(x2 - x5) + a24*(x3 - x4);
  let d22 = a14*(x4 - x3) + a13*(x5 - x2) + a12*(x6 - x1);
  let d33 = a44*(x7 - x11) + a42*(x8 - x10) + a43*(x9 - x12);
  let d44 = a32*(x10 - x8) + a34*(x11 - x7) + a33*(x12 - x9);

  return a11*d11 + a21*d22 + a31*d33 + a41*d44;
}

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
