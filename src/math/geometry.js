import {
  subtract,
  normalize,
  crossproduct,
} from "./vector3.js";

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

  return normals.map(_fixZeros);
}

export function getTriangleComponents(vertices, offsets) {
  // Items can be vertex coordinates, texture coordinates, normal coordinates,
  // and even color information.
  // When color is provided, we will use the vertex offsets to determine the
  // color of each vertex. But sometimes color is not defined in the obj file
  // so vertices will be an empty array. And since offsets are for the vertex
  // coordinates, which typically have data, we would iterate over an empty
  // array. This early return makes sure that if there are no vertices then
  // we don't iterate over it.
  if (vertices.length === 0) {
    return [];
  }

  const outVertices = [];

  for (let i = 0; i < offsets.length; i++) {
    const offset = (offsets[i]*3);
    outVertices.push(vertices[offset], vertices[offset+1], vertices[offset+2]);
  }

  return outVertices.map(_fixZeros);
}

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
