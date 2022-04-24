import {normalize, crossproduct, edges} from "./vector3.js";

export function normalizeTriangleVertices(vertices, smoothing = false) {
  const normals = [];

  for (let offset = 0; offset < vertices.length; offset += 9) {
    const vertOffset1 = offset;
    const vertOffset2 = offset + 3;
    const vertOffset3 = offset + 6;

    const [edge1, edge2] = edges(
      trianglesFromVertices(vertices, vertOffset1),
      trianglesFromVertices(vertices, vertOffset2),
      trianglesFromVertices(vertices, vertOffset3)
    );
    const [nx, ny, nz] = normalize(...crossproduct(edge1, edge2));

    for (let j = 0; j < 3; j++) {
      normals.push(nx, ny, nz);
    }
  }

  if (smoothing) {
    smoothNormals(vertices, normals);
  }

  return normals.map(_fixZeros);
}

function trianglesFromVertices(vertices, offset) {
  return [vertices[offset], vertices[offset + 1], vertices[offset + 2]];
}

// smoothNormals smooths out normal vertors that correspond to the triangle
// vertices.
// Smoothing is a two main step process, the rest is implementation details:
// 1. we find all vertices that are the same (shared vertices) and keep
//    track of their indexes.
// 2. we find all the normals at those indexes and average them by adding
//    them all up and dividing them by the number of shared vertices.
//
// NOTE(miguel): for effciency purposes, this function will update the
// incoming normals array. This avoids just thrashing the garbage collector.
// If you want you can call `slice(0)` on the normals before calling
// smoothNormals.
export function smoothNormals(vertices, normals) {
  const vexterMap = buildIndexes(vertices);

  for (let key of Object.keys(vexterMap)) {
    const count = vexterMap[key].length;
    if (count < 2) {
      continue;
    }

    averageVertex(normals, vexterMap[key]);
  }
}

export function buildIndexes(vertices) {
  const vexterMap = {};

  for (let offset = 0; offset < vertices.length; offset += 3) {
    const v = trianglesFromVertices(vertices, offset);
    if (!vexterMap[v]) {
      vexterMap[v] = [];
    }
    vexterMap[v].push(offset);
  }

  return vexterMap;
}

export function averageVertex(v, offsets) {
  const count = offsets.length;
  const averageV = [0, 0, 0];

  for (let offset of offsets) {
    averageV[0] += v[offset];
    averageV[1] += v[offset + 1];
    averageV[2] += v[offset + 2];
  }

  averageV[0] /= count;
  averageV[1] /= count;
  averageV[2] /= count;

  for (let offset of offsets) {
    const [nx, ny, nz] = normalize(...averageV);
    v[offset] = nx;
    v[offset + 1] = ny;
    v[offset + 2] = nz;
  }
}

// getIndexed3DComponents returns a new array by reading 3D indexes data
// from the provided array of coordinates. This is for processing (mostly)
// data for XYZ 3D rendering like vertex and normal coordinates. This is
// very similar to getIndexed2DComponents except that getIndexed3DComponents
// has a Z (third) coordinate.
//
// v3       v2
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
  return getIndexedComponents(coordinates, indexes, 3);
}

// getIndexed2DComponents returns a new array by reading 2D indexed data
// from the provided array of coordinates. Main use cases are UV vertices
// for textures and 2 dimensional rendering where models contain XY
// coordinates instead of XYZ as you'd see in 3D like getIndexed3DComponents
// supports.
// Consider the 4 vertices (8 coordinates) for the quad below, which is
// rendered as two triangles. The coordinates are listed counter clockwise.
//
// v3       v2
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
  return getIndexedComponents(coordinates, indexes, 2);
}

export function getIndexedComponents(coordinates, indexes, componentsPerVertex) {
  if (coordinates.length === 0) {
    return [];
  }

  const result = [];

  for (let i = 0; i < indexes.length; i++) {
    const coffset = indexes[i] * componentsPerVertex;
    const ioffset = i * componentsPerVertex;

    for (let j = 0; j < componentsPerVertex; j++) {
      result[ioffset + j] = coordinates[coffset + j];
    }
  }

  return result;
}

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
