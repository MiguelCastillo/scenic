import {
  calculateFactor,
  calculateTangentVector,
  calculateBiTangentVector,
  getTBNVectorsFromTriangle,
} from "./tbn-matrix.js"

import {
  dotproduct,
  edges as edges3v,
} from "./vector3.js";

import {
  edges as edgesUV,
} from "./vector2.js";

// NOTE: Some of the geometry vertices and UVs are from fbx.test.js which
// loads a model that constains this information.

test("calculateFactor", () => {
  expect(
    calculateFactor(
      ...edgesUV(
        [0.625,  0.5],
        [0.875,  0.5],
        [0.875, 0.75],
      ),
    )
  ).toEqual(16);
});

test("calculateTangentVector and calculateBiTangentVector", () => {
  const [euv1, euv2] = edgesUV(
    [0.625,  0.5],
    [0.875,  0.5],
    [0.875, 0.75],
  );

  const factor = calculateFactor(euv1, euv2);

  const [e1, e2] = edges3v(
    [ 1,  1,  1],  // vert 1 |
    [-1,  1,  1],  // vert 2 | triangle 1
    [-1, -1,  1],  // vert 3 |
  );

  const tangent = calculateTangentVector(factor, e1, e2, euv1, euv2);
  expect(tangent).toEqual([-8, 0, 0]);

  const bitangent = calculateBiTangentVector(factor, e1, e2, euv1, euv2);
  expect(bitangent).toEqual([0, -8, 0]);

  // tangent and bitangent are orthogonal, so their dotproduct is 0.
  expect(dotproduct(tangent, bitangent)).toEqual(0);
});

test("getTBNVectorsFromTriangle and verify vectors are orthogonal", () => {
  const [tangent, bitangent, normal] = getTBNVectorsFromTriangle(
    // Vertices for the triangle.
    [ 1,  1,  1], // v0 |
    [-1,  1,  1], // v4 | triangle 1
    [-1, -1,  1], // v6 |

    // UV coordinates for the triangle.
    [0.625,  0.5],
    [0.875,  0.5],
    [0.875, 0.75],
  );

  expect(dotproduct(tangent, bitangent)).toEqual(0);
  expect(dotproduct(tangent, normal)).toEqual(0);
  expect(dotproduct(bitangent, normal)).toEqual(0);

  expect(tangent).toEqual([-1, 0, 0]);
  expect(bitangent).toEqual([0, -1, 0]);
  expect(normal).toEqual([0, 0, 1]);
});
