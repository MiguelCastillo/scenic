import {buildIndexes, averageVertex} from "./geometry.js";

import {normalize, crossproduct, edges as edges3v} from "./vector3.js";

import {edges as edgesUV} from "./vector2.js";

export function calculateFactor(euv1, euv2) {
  return euv1[0] * euv2[1] - euv2[0] * euv1[1];
}

export function calculateTangentVector(factor, edge1, edge2, euv1, euv2) {
  return [
    factor * (euv2[1] * edge1[0] - euv1[1] * edge2[0]),
    factor * (euv2[1] * edge1[1] - euv1[1] * edge2[1]),
    factor * (euv2[1] * edge1[2] - euv1[1] * edge2[2]),
  ];
}

export function calculateBiTangentVector(factor, edge1, edge2, euv1, euv2) {
  return [
    factor * (-euv2[0] * edge1[0] + euv1[0] * edge2[0]),
    factor * (-euv2[0] * edge1[1] + euv1[0] * edge2[1]),
    factor * (-euv2[0] * edge1[2] + euv1[0] * edge2[2]),
  ];
}

export function getTBNVectorsFromTriangle(v1, v2, v3, uv1, uv2, uv3) {
  const [e1, e2] = edges3v(v1, v2, v3);
  const [euv1, euv2] = edgesUV(uv1, uv2, uv3);
  let factor = calculateFactor(euv1, euv2);

  // Handle division by 0.
  if (!factor) {
    factor = 1000000;
  } else {
    factor = 1 / factor;
  }

  const normal = normalize(...crossproduct(e1, e2));
  const tangent = normalize(...calculateTangentVector(factor, e1, e2, euv1, euv2));

  // So far with limited testing, the calculated bitrangent gives the same
  // results as the crossprodut between normal and tangent.
  //const bitangent = normalize(...calculateBiTangentVector(factor, e1, e2, euv1, euv2));
  const bitangent = normalize(...crossproduct(tangent, normal));

  // Ideally these vectors are orthogonal to each other so that we can
  // build an orhtogonal (actually an orthonormal) matrix. This allows
  // us to find inverse matrices by simply transposing them. Otherwise,
  // we will get into more complicated math to invert matrices. We want
  // to find the inverse when we want to convert coordinates from one
  // space to tangent space, which is primarily used for normal map
  // calculations where we convert camera and light position to tangent
  // space as used in pixel lighting provided by normal maps.
  // Being orthogonal also means we have a basis matrix.
  return [
    tangent, // T
    bitangent, // B
    normal, // N
  ];
}

function getTriangleVertex(vertices, offset) {
  return [vertices[offset], vertices[offset + 1], vertices[offset + 2]];
}

function getTriangleUV(uvs, offset) {
  return [uvs[offset], uvs[offset + 1]];
}

export function getTBNVectorsFromTriangles(vertices, uvs, normalSmoothing = true) {
  if (uvs.length !== vertices.length - vertices.length / 3) {
    throw new Error("vertices and uvs length do not match!");
  }

  let tangents = [];
  let bitangents = [];
  let normals = [];

  for (let i = 0; i < vertices.length / 9; i++) {
    const voffset = i * 9;
    const uvoffset = i * 6;

    const [t, b, n] = getTBNVectorsFromTriangle(
      getTriangleVertex(vertices, voffset),
      getTriangleVertex(vertices, voffset + 3),
      getTriangleVertex(vertices, voffset + 6),
      getTriangleUV(uvs, uvoffset),
      getTriangleUV(uvs, uvoffset + 2),
      getTriangleUV(uvs, uvoffset + 4)
    );

    // We need to add one tbn for each triangle vertex. We will smooth
    // out all these vectors to get best rendering results.
    tangents.push(...t);
    tangents.push(...t);
    tangents.push(...t);
    bitangents.push(...b);
    bitangents.push(...b);
    bitangents.push(...b);
    normals.push(...n);
    normals.push(...n);
    normals.push(...n);
  }

  if (normalSmoothing) {
    smoothTBN(vertices, tangents, bitangents, normals);
  }

  return [tangents.map(_fixZeros), bitangents.map(_fixZeros), normals.map(_fixZeros)];
}

function _fixZeros(a) {
  return a === -0 ? 0 : a;
}

export function smoothTBN(vertices, tangents, bitangents, normals) {
  const vexterMap = buildIndexes(vertices);

  for (let key of Object.keys(vexterMap)) {
    const count = vexterMap[key].length;
    if (count < 2) {
      continue;
    }

    averageVertex(tangents, vexterMap[key]);
    averageVertex(bitangents, vexterMap[key]);
    averageVertex(normals, vexterMap[key]);
  }
}
