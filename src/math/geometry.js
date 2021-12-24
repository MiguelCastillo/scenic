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

// getTriangleComponents returns a new array by reading 3D indexes data
// from the provided array of coordinates. This is for processing (mostly)
// data for XYZ 3D rendering like vertex and normal coordinates. This is
// very similar to getIndexed2DComponents except that getIndexed3DComponents
// has a Z (third) coordinate.
//
// v2       v3
//  +-------+
//  |     . |
//  |   .   |
//  | .     |
//  +-------+
// v0       v1
// 
// coordinates:
//  0, 0, 0, // v0
//  1, 0, 0, // v1
//  1, 1, 0, // v2
//  0, 1, 0, // v3
//
// indexes:
//  0, 1, 2, // triangle 1
//  0, 2, 3, // triangle 2
//
// The output will be:
//  0, 0, 0, // v0 |
//  1, 0, 0, // v1 | triangle 1
//  1, 1, 0, // v2 |
//
//  0, 0, 0, // v0 |
//  1, 1, 0, // v2 | triangle 2
//  0, 1, 0, // v3 |
//
export function getIndexed3DComponents(coordinates, indexes) {
  if (coordinates.length === 0) {
    return [];
  }

  // Items can be vertex coordinates, normal coordinates, or even color
  // information.
  const result = [];

  for (let i = 0; i < indexes.length; i++) {
    const offset = (indexes[i]*3);
    result.push(coordinates[offset], coordinates[offset+1], coordinates[offset+2]);
  }

  return result;
}

// TODO(miguel): transition everything to use getIndexed3DComponents, but
// in the meantime we have an alias to make the transition easier.
export const getTriangleComponents = getIndexed3DComponents;

// getIndexed2DComponents returns a new array by reading 2D indexed data
// from the provided array of coordinates. Main use cases are UV vertices
// for textures and 2 dimensional rendering where models contain XY
// coordinates instead of XYZ as you'd see in 3D like getIndexed3DComponents
// supports.
// Consider the 4 vertices (8 coordinates) for the quad below, which is
// rendered as two triangles. The coordinates are listed counter clockwise.
//
// v2       v3
//  +-------+
//  |     . |
//  |   .   |
//  | .     |
//  +-------+
// v0       v1
//
// coordinates:
//  0, 0, // v0
//  1, 0, // v1
//  1, 1, // v2
//  0, 1, // v3
//
// indexes:
//  0, 1, 2, // triangle 1
//  0, 2, 3, // triangle 2
//
// The output will be:
//  0, 0, // v0 |
//  1, 0, // v1 | triangle 1
//  1, 1, // v2 |
//
//  0, 0, // v0 |
//  1, 1, // v2 | triangle 2
//  0, 1, // v3 |
//
// A few reasons why to do this.  With large data sets, this can yield smaller
// files. And when dealing with multiple data buffers, you can use a single
// index array for multiple buffers for things like vertex, normals, and
// texture coordinates which can be effciently processed by WebGL and uses
// less memory.
//
export function getIndexed2DComponents(coordinates, indexes) {
  if (coordinates.length === 0) {
    return [];
  }

  const result = [];

  for (let i = 0; i < indexes.length; i++) {
    const offset = indexes[i]*2;
    result.push(coordinates[offset], coordinates[offset+1]);
  }

  return result;
}

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
