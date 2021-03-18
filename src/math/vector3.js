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

export function normalizeTriangleVertices(vertices) {
  function trianglesFromVertices(vertices, offset) {
    return [vertices[offset], vertices[offset+1], vertices[offset+2]];
  }

  const normals = [];

  for (let i = 0; i < vertices.length/9; i++) {
    const offset = i * 9;
    const vertOffset1 = offset;
    const vertOffset2 = offset + 3;
    const vertOffset3 = offset + 6;

    const [v1, v2, v3] = [
      trianglesFromVertices(vertices, vertOffset1),
      trianglesFromVertices(vertices, vertOffset2),
      trianglesFromVertices(vertices, vertOffset3),
    ];

    const a = subtract(v3, v1);
    const b = subtract(v3, v2);
    const [nx, ny, nz] = normalize(...crossproduct(a, b));

    for (let j = 0; j < 3; j++) {
      normals[vertOffset1 + (j*3)     ] = nx;
      normals[vertOffset1 + (j*3) + 1 ] = ny;
      normals[vertOffset1 + (j*3) + 2 ] = nz;
    }
  }

  return normals;
}
