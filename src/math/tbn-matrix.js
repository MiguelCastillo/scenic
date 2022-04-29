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

export function getTBNVectorsFromTriangles(vertices, uvs, renderIndexes, normalSmoothing = true) {
  if (uvs.length !== vertices.length - vertices.length / 3) {
    // eslint-disable-next-line no-console
    console.warn("===> vertices and uvs length do not match!");
  }

  let tangents = [];
  let bitangents = [];
  let normals = [];

  for (let i = 0; i < renderIndexes.length; i += 3) {
    const voffset1 = renderIndexes[i] * 3;
    const voffset2 = renderIndexes[i + 1] * 3;
    const voffset3 = renderIndexes[i + 2] * 3;
    const uvoffset1 = renderIndexes[i] * 2;
    const uvoffset2 = renderIndexes[i + 1] * 2;
    const uvoffset3 = renderIndexes[i + 2] * 2;

    const [t, b, n] = getTBNVectorsFromTriangle(
      [vertices[voffset1], vertices[voffset1 + 1], vertices[voffset1 + 2]],
      [vertices[voffset2], vertices[voffset2 + 1], vertices[voffset2 + 2]],
      [vertices[voffset3], vertices[voffset3 + 1], vertices[voffset3 + 2]],
      [uvs[uvoffset1], uvs[uvoffset1 + 1]],
      [uvs[uvoffset2], uvs[uvoffset2 + 1]],
      [uvs[uvoffset3], uvs[uvoffset3 + 1]]
    );

    // We need to add one tbn for each triangle vertex. We will smooth
    // out all these vectors to get best rendering results.
    tangents.splice(voffset1, 0, ...t);
    tangents.splice(voffset2, 0, ...t);
    tangents.splice(voffset3, 0, ...t);
    bitangents.splice(voffset1, 0, ...b);
    bitangents.splice(voffset2, 0, ...b);
    bitangents.splice(voffset3, 0, ...b);
    normals.splice(voffset1, 0, ...n);
    normals.splice(voffset2, 0, ...n);
    normals.splice(voffset3, 0, ...n);
  }

  if (normalSmoothing) {
    // smoothTBN(vertices, tangents, bitangents, normals);
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
