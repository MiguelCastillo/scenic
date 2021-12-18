export function normalize(x, y, z) {
  const len = Math.sqrt(x*x + y*y + z*z);
  const fixedLen = len ? len : 1;
  return [x/fixedLen, y/fixedLen, z/fixedLen];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function crossproduct(a, b) {
  // Nx = Ay * Bz - Az * By
  // Ny = Az * Bx - Ax * Bz
  // Nz = Ax * By - Ay * Bx

  return [
    a[1] * b[2] - a[2] * b[1], // Nx
    a[2] * b[0] - a[0] * b[2], // Ny
    a[0] * b[1] - a[1] * b[0], // Nz
  ];
}

export function dotproduct(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
