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
      return `-(${a.substr(1)} * ${b})`;
    }
    if (b[0] === "-") {
      return `-(${a} * ${b.substr(1)})`;
    }
    return `${a} * ${b}`;
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

export const rotX = [
  1,   0,  0, 0,
  0,  "cx", "-sx", 0,
  0, "sx", "cx", 0,
  0,   0,  0, 1,
];
export const rotY = [
  "cy", 0, "sy", 0,
  0, 1,   0, 0,
  "-sy", 0,  "cy", 0,
  0, 0,   0, 1,
];
export const rotZ = [
  "cz", "-sz", 0, 0,
  "sz", "cz", 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export function generateRotationFunction(rotationMatrix) {
  return new Function("degreesX", "degreesY", "degreesZ", `
    const degToRadMultiplier = Math.PI/180;
    const degToRad = (a) => (a*degToRadMultiplier);
    const sx = Math.sin(degToRad(degreesX)), cx = Math.cos(degToRad(degreesX));
    const sy = Math.sin(degToRad(degreesY)), cy = Math.cos(degToRad(degreesY));
    const sz = Math.sin(degToRad(degreesZ)), cz = Math.cos(degToRad(degreesZ));
    return [${rotationMatrix}];
  `);
}

export function generateRotationFunctionWithDest(rotationMatrix) {
  return new Function("dest", "degreesX", "degreesY", "degreesZ", `
    const degToRadMultiplier = Math.PI/180;
    const degToRad = (a) => (a*degToRadMultiplier);
    const sx = Math.sin(degToRad(degreesX)), cx = Math.cos(degToRad(degreesX));
    const sy = Math.sin(degToRad(degreesY)), cy = Math.cos(degToRad(degreesY));
    const sz = Math.sin(degToRad(degreesZ)), cz = Math.cos(degToRad(degreesZ));

    dest[0] = ${rotationMatrix[0]};
    dest[1] = ${rotationMatrix[1]};
    dest[2] = ${rotationMatrix[2]};
    dest[4] = ${rotationMatrix[4]};
    dest[5] = ${rotationMatrix[5]};
    dest[6] = ${rotationMatrix[6]};
    dest[8] = ${rotationMatrix[8]};
    dest[9] = ${rotationMatrix[9]};
    dest[10] = ${rotationMatrix[10]};
    return dest;
  `);
}

// NOTE(miguel): these indexes are copied from matrix4.js and they should
// stay in sync to ensure that matrices are indexed consistently.
//
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
