// This file contains functionality for 4x4 matrices to support matrix
// transformation such as translation, rotation, and scaling for 3D
// rendering.
//
// A transformation matrix in this module looks like:
// a, b, c, tx,
// d, e, f, ty,
// g, h, i, tz,
// 0, 0, 0, 1
//
// From a-i we have the rotation matrix with scale in the diagonal with
// a, e, and i. Lastly, we have tx, ty, and tz in the last column for
// translation.
//
// So why is translation the last column in the transformation matrix?
// This hugely dependents on the order in which we multiply view matrices by
// vertex vectors in the vertex shader, and how we cascade matrix
// multiplication in the scene graph from parent to children nodes.
// So let's discuss.
//
// Matrix multiplication occurs left to right, so we cascade multiplications
// from matrices from the left most matrix to the right most matrix. E.g
// A*B*C mean A times B time C and we multiply them in that order.
// To multiply a matrix with a vertex vector, we have the choice to treat
// the vector as a row major matrix or a column major matrix.
//
// Column major matrix is 3 rows 1 column such as:
// | x |
// | y |
// | z |
//
// Row major matrix is 1 row and 3 columns such as:
// [ x, y, z ]
//
// To multiply a matrix by column major matrix we apply a transformation matrix
// from the left as in:
//
// |a, b, c|   |x|
// |d, e, f| * |y| = transformed vector.  (B = A*v)
// |g, h, i|   |z|
//
// To multiply a matrix by a row major matrix we apply the vector from the left
// as in:
//
//             |a, d, g|
// |x, y, z| * |b, e, h| = transformed vector.  (B = v*A)
//             |c, f, i|
//
// In row major order where the matrix is on the right, the matrix needs to be
// transposed for the multiplication to yield the same result as column
// major multiplication. So depending on the order in which you multiply your
// transform matrices and your vertex vectors, you will need to ensure that
// matrix multiplication in the scene graph is done consistently or chaos and
// bugs will take over. The most painful part of this is in the rotation
// matrices where having the wrong ordering will generate the wrong
// transformations with results that are very hard to debug.
//
// The reason I have chosen to put the translation on the last column is that
// most math literature and tools you find online align with column major
// ordering; remember that row major requires you to use transpose matrices
// when multiplying with a vector. So if you are implementing your own matrix
// rotation functionality or just fixing a bug, most literature and tools you
// find will use matrices to rotate each axis based on column major
// multiplication, which aligns better with the translation on the last column.
// Otherwise, placing translation in the last row means that most stuff you
// read about matrices will innevitably generate a good amount of friction
// because rotation matrices are transposed.
//
// quaternion rotation is also an important factor here. quaternion rotation
// in its conventional ordering will generate rotation matrices that are
// aligned with column major ordering. And "Alternative conventions" are
// actually discouraged!
// https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
//
// The mental load is significant enough that I chose to use column major
// (translation on the last column).
//
// The only tricky part is that in column major where you specify your
// transofmation matrix on the left and the vertex vector on the right in
// vertex shaders, you will need to transpose the matrix when calling
// uniformMatrix4fv. The reason is that the way GLSL in webgl iterates the
// matrix is transposed. So be sure to specify `true` in your call to
// uniformMatrix4fv or transpose the matrix yourself before calling
// uniformMatrix4fv.
//
// The rotation matrix in this module are the combined form of Tait–Bryan
// angles ZYX, so rotating is done in a single matrix multiplication operation.
// For details on Tait–Bryan angles ZYX, check out
// https://en.wikipedia.org/wiki/Euler_angles
//
// https://www.khanacademy.org/math/linear-algebra/matrix-transformations#lin-trans-examples
// http://extranet.nmrfam.wisc.edu/nmrfam_documents/bchm800/notes/chapt4.pdf
// https://danceswithcode.net/engineeringnotes/rotations_in_3d/rotations_in_3d_part1.html
//

import {sin, cos} from "./angles.js";
import {matrixFloatPrecision} from "./float.js";

export class Matrix4 {
  constructor(data) {
    if (!data) {
      return Matrix4.identity();
    }

    if (data instanceof Matrix4) {
      this._data = data._data.slice();
    } else {
      this._data = data;
    }
  }

  get data() {
    return this._data.map(v => _fixZeros(matrixFloatPrecision(v)));
  }

  static identity() {
    return new Matrix4(identity());
  }

  static rotation(degreesX, degreesY, degreesZ) {
    return new Matrix4(rotate(identity(), degreesX, degreesY, degreesZ));
  }

  static translation(tx, ty, tz) {
    return new Matrix4(translate(tx, ty, tz));
  }

  static scale(sx, sy, sz) {
    return new Matrix4(scale(sx, sy, sz));
  }

  rotate(degreesX, degreesY, degreesZ) {
    const r = rotate(identity(), degreesX, degreesY, degreesZ);
    return new Matrix4(multiply(r, this._data, r));
  }

  scale(sx, sy, sz) {
    const r = scale(sx, sy, sz);
    return new Matrix4(multiply(r, this._data, r));
  }

  translate(tx, ty, tz) {
    const r = translate(tx, ty, tz);
    return new Matrix4(multiply(r, this._data, r));
  }

  multiply(mat4) {
    return new Matrix4(multiply(identity(), this._data, mat4._data));
  }

  rotation(degreesX, degreesY, degreesZ) {
    // TODO(miguel): this looks like it clears scaling. Let's fix.
    const data = rotate(identity(), degreesX, degreesY, degreesZ);
    data[_03] = this._data[_03];
    data[_13] = this._data[_13];
    data[_23] = this._data[_23];
    return new Matrix4(data);
  }

  translation(tx, ty, tz) {
    const data = this._data.slice();
    data[_03] = tx;
    data[_13] = ty;
    data[_23] = tz;
    return new Matrix4(data);
  }

  scaling(sx, sy, sz) {
    const data = this._data.slice();
    data[_00] = sx;
    data[_11] = sy;
    data[_22] = sz;
    return new Matrix4(data);
  }

  transpose() {
    return new Matrix4(transpose(this._data));
  }

  invert() {
    return new Matrix4(invert([], this._data));
  }

  multiplyInverse(m) {
    const r = [];
    return new Matrix4(multiply(r, invert(r, this._data), m._data));
  }

  clone() {
    return new Matrix4(this);
  }

  equal(m) {
    return this._data.every((d, i) => d === m._data[i]);
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

export function translate(tx, ty, tz) {
  return [
    1,  0,  0,  tx,
    0,  1,  0,  ty,
    0,  0,  1,  tz,
    0,  0,  0,  1,
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

// TODO(miguel): use quaternions instead of rotating one axis at a time.
//
// Rotation matices are auto generate with generateRotationMatrix
// as below.
// const rotationMatrix = generateRotationMatrix([], onZ, onY, onX);
//
// https://danceswithcode.net/engineeringnotes/rotations_in_3d/rotations_in_3d_part1.html
export function rotate(dest, degreesX, degreesY, degreesZ) {
  let sx = sin(degreesX), cx = cos(degreesX);
  let sy = sin(degreesY), cy = cos(degreesY);
  let sz = sin(degreesZ), cz = cos(degreesZ);

  // NOTE(miguel): Tait–Bryan yaw, pitch, roll, around the z, y and x axes
  // respectively is usually how rotation matrices are setup.
  // Usually the mental model for a rotation matrix is to apply X, Y, and Z
  // axis rotations in that order to some vector, or even another matrix.
  // However, rotation matrix multiplication is unintuitively done from right
  // to left (ZYX) in practice. That's assuming that the things (vector or
  // matrix) we are affecting is on the right side of the rotation matrix. E.g
  // (x', y', z') = Az*Ay*Ax*v(x, y, z)
  // The reason for that is that we want to first rotate the vector on X, so
  // the first multiplication is the rotation X matrix times the vector. Then
  // Y, and then Z. What can make this counter intuitive is that it is easy
  // to think of applying the rotation to subsequent rotation matrices, but
  // in reality we are really applying the rotation on the vector.
  // Tait–Bryan angles ZYX
  dest[0] = cz*cy;
  dest[1] = cz*sy*sx-(sz*cx);
  dest[2] = sz*sx+cz*sy*cx;
  dest[4] = sz*cy;
  dest[5] = cz*cx+sz*sy*sx;
  dest[6] = sz*sy*cx-(cz*sx);
  dest[8] = -sy;
  dest[9] = cy*sx;
  dest[10] = cy*cx;
  return dest;
}

export function multiply(dest, a, b) {
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

  // First row = first row of B times all columns of A
  dest[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
  dest[1] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
  dest[2] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
  dest[3] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,

  // Second row = second row of B times all columns of A
  dest[4] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
  dest[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
  dest[6] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
  dest[7] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;

  // Thrid row = third row of B times all columns of A
  dest[8] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
  dest[9] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
  dest[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
  dest[11] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;

  // Fourth row = fourth row of B times all columns of A
  dest[12] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
  dest[13] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
  dest[14] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
  dest[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;
  return dest;
};

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

// https://www.chilimath.com/lessons/advanced-algebra/determinant-3x3-matrix/
// https://semath.info/src/inverse-cofactor-ex4.html
// https://www.mathsisfun.com/algebra/matrix-inverse.html
export function invert(dest, data) {
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

  let d11 = a22*(x1 - x6) + a23*(x2 - x5) + a24*(x3 - x4);
  let d22 = a14*(x4 - x3) + a13*(x5 - x2) + a12*(x6 - x1);
  let d33 = a44*(x7 - x11) + a42*(x8 - x10) + a43*(x9 - x12);
  let d44 = a32*(x10 - x8) + a34*(x11 - x7) + a33*(x12 - x9);

  const factor = 1/(a11*d11 + a21*d22 + a31*d33 + a41*d44);

  dest[0] = d11*factor;
  dest[1] = d22*factor;
  dest[2] = d33*factor;
  dest[3] = d44*factor;
  dest[4] = (a24*(x15 - x14) + a23*(x16 - x13) + a21*(x6 - x1))*factor;
  dest[5] = (a11*(x1 - x6) + a13*(x13 - x16) + a14*(x14 - x15))*factor;
  dest[6] = (a41*(x10 - x8) + a44*(x19 - x17) + a43*(x20 - x18))*factor;
  dest[7] = (a34*(x17 - x19) + a31*(x8 - x10) + a33*(x18 - x20))*factor;
  dest[8] = (a21*(x5 - x2) + a22*(x13 - x16) + a24*(x21 - x22))*factor;
  dest[9] = (a14*(x22 - x21) + a12*(x16 - x13) + a11*(x2 - x5))*factor;
  dest[10] = (a44*(x24 - x23) + a41*(x12 - x9) + a42*(x18 - x20))*factor;
  dest[11] = (a31*(x9 - x12) + a34*(x23 - x24) + a32*(x20 - x18))*factor;
  dest[12] = (a23*(x22 - x21) + a22*(x14 - x15) + a21*(x4 - x3))*factor;
  dest[13] = (a11*(x3 - x4) + a12*(x15 - x14) + a13*(x21 - x22))*factor;
  dest[14] = (a41*(x11 - x7) + a43*(x23 - x24) + a42*(x17 - x19))*factor;
  dest[15] = (a33*(x24 - x23) + a31*(x7 - x11) + a32*(x19 - x17))*factor;

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

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}

// This generates a matrix my multiplying matrix a and b and it generates
// another matrix that you use in your code with variables. This is a helpful
// way to auto generate matrices for stuff like rotation on X, Y, and Z.
//
// generateRotationMatrix([], [
//   1,   0,  0, 0,
//   0,  "cx", "sx", 0,
//   0, "-sx", "cx", 0,
//   0,   0,  0, 1,
// ], [
//   "cy", 0, "-sy", 0,
//   0, 1,   0, 0,
//   "sy", 0,  "cy", 0,
//   0, 0,   0, 1,
// ], [
//   "cz", "sz", 0, 0,
//   "-sz", "cz", 0, 0,
//   0, 0, 1, 0,
//   0, 0, 0, 1,
// ]);
//
// Will return:
// [
//   cz*cy, cz*sy*sx+sz*cx, -(cz*(sy*cx))+sz*sx, 0,
//   -(sz*cy), -(sz*sy*sx)+cz*cx, sz*(sy*cx)+cz*sx, 0,
//   sy, -(cy*sx), cy*cx, 0,
//   0, 0, 0, 1,
// ]
export function generateRotationMatrix(dest, ...mats) {
  return mats.reduce((a, b) => multiplyRotationMatrix(dest, a, b));
}

function multiplyRotationMatrix(dest, a, b) {
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

  const multiplyString = (a, b) => {
    if (!a || !b) {
      return 0;
    }
    if (a === 1) {
      return b;
    }
    if (b === 1) {
      return a;
    }
    if (a[0] === "-" && b[0] === "-") {
      a = a.substr(1);
      b = b.substr(1);
    }
    if (a[0] === "-") {
      return "-(" + a.substr(1) + "*" + b + ")";
    }
    if (b[0] === "-") {
      return "-(" + a + "*" + b.substr(1) + ")";
    }
    return a + "*" + b;
  }

  const concatRow = (row) => {
    const add = row.filter(Boolean).filter(a => a[0] !== "-").join("+");
    const sub = row.filter(Boolean).filter(a => a[0] === "-").join("");
    return [...add, ...sub].join("");
  }

  const fixResult = (s) => {
    if (!s) {
      return 0;
    }
    if (s === "1") {
      return 1;
    }
    return s;
  }

  // First row = first row of B times all columns of A
  dest[0] = [multiplyString(a00, b00), multiplyString(a01, b10), multiplyString(a02, b20), multiplyString(a03, b30)];
  dest[1] = [multiplyString(a00, b01), multiplyString(a01, b11), multiplyString(a02, b21), multiplyString(a03, b31)];
  dest[2] = [multiplyString(a00, b02), multiplyString(a01, b12), multiplyString(a02, b22), multiplyString(a03, b32)];
  dest[3] = [multiplyString(a00, b03), multiplyString(a01, b13), multiplyString(a02, b23), multiplyString(a03, b33)];

  // Second row = second row of B times all columns of A
  dest[4] = [multiplyString(a10, b00), multiplyString(a11, b10), multiplyString(a12, b20), multiplyString(a13, b30)];
  dest[5] = [multiplyString(a10, b01), multiplyString(a11, b11), multiplyString(a12, b21), multiplyString(a13, b31)];
  dest[6] = [multiplyString(a10, b02), multiplyString(a11, b12), multiplyString(a12, b22), multiplyString(a13, b32)];
  dest[7] = [multiplyString(a10, b03), multiplyString(a11, b13), multiplyString(a12, b23), multiplyString(a13, b33)];


  // Thrid row = third row of B times all columns of A
  dest[8] = [multiplyString(a20, b00), multiplyString(a21, b10), multiplyString(a22, b20), multiplyString(a23, b30)];
  dest[9] = [multiplyString(a20, b01), multiplyString(a21, b11), multiplyString(a22, b21), multiplyString(a23, b31)];
  dest[10] = [multiplyString(a20, b02), multiplyString(a21, b12), multiplyString(a22, b22), multiplyString(a23, b32)];
  dest[11] = [multiplyString(a20, b03), multiplyString(a21, b13), multiplyString(a22, b23), multiplyString(a23, b33)];

  // Fourth row = fourth row of B times all columns of A
  dest[12] = [multiplyString(a30, b00), multiplyString(a31, b10), multiplyString(a32, b20), multiplyString(a33, b30)];
  dest[13] = [multiplyString(a30, b01), multiplyString(a31, b11), multiplyString(a32, b21), multiplyString(a33, b31)];
  dest[14] = [multiplyString(a30, b02), multiplyString(a31, b12), multiplyString(a32, b22), multiplyString(a33, b32)];
  dest[15] = [multiplyString(a30, b03), multiplyString(a31, b13), multiplyString(a32, b23), multiplyString(a33, b33)];

  return dest.map(concatRow).map(fixResult);
};

const onX = [
  1,   0,  0, 0,
  0,  "cx", "-sx", 0,
  0, "sx", "cx", 0,
  0,   0,  0, 1,
];
const onY = [
  "cy", 0, "sy", 0,
  0, 1,   0, 0,
  "-sy", 0,  "cy", 0,
  0, 0,   0, 1,
];
const onZ = [
  "cz", "-sz", 0, 0,
  "sz", "cz", 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];
