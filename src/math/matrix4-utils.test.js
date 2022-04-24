import {identity} from "./matrix4.js";
import {
  generateRotationMatrix,
  generateRotationFunction,
  generateRotationFunctionWithDest,
  rotX,
  rotY,
  rotZ,
} from "./matrix4-utils.js";
import {matrixFloatPrecision} from "./float.js";

test("generating XYZ matrix", () => {
  const r = generateRotationMatrix([], rotX, rotY, rotZ).join(", ");
  expect(r).toEqual(
    "cy * cz, -(cy * sz), sy, 0, sx * sy * cz+cx * sz, cx * cz-(sx * sy * sz), -(sx * cy), 0, sx * sz-((cx * sy) * cz), (cx * sy) * sz+sx * cz, cx * cy, 0, 0, 0, 0, 1"
  );
});

test("generating ZYX matrix", () => {
  const r = generateRotationMatrix([], rotZ, rotY, rotX).join(", ");
  expect(r).toEqual(
    "cz * cy, cz * sy * sx-(sz * cx), sz * sx+cz * sy * cx, 0, sz * cy, cz * cx+sz * sy * sx, sz * sy * cx-(cz * sx), 0, -sy, cy * sx, cy * cx, 0, 0, 0, 0, 1"
  );
});

test("generating ZYZ matrix", () => {
  const r = generateRotationMatrix([], rotZ, rotY, rotZ).join(", ");
  expect(r).toEqual(
    "cz * cy * cz-(sz * sz), -(cz * cy * sz)-(sz * cz), cz * sy, 0, sz * cy * cz+cz * sz, cz * cz-(sz * cy * sz), sz * sy, 0, -(sy * cz), sy * sz, cy, 0, 0, 0, 0, 1"
  );
});

test("generate ZYX rotation function", () => {
  const rotationMatrixString = generateRotationMatrix([], rotZ, rotY, rotX);
  const rotate = generateRotationFunction(rotationMatrixString);

  expect(rotate(45, 0, 0).map(fixMatrixValue)).toEqual([
    1, 0, 0, 0, 0, 0.70711, -0.70711, 0, 0, 0.70711, 0.70711, 0, 0, 0, 0, 1,
  ]);

  expect(rotate(45, 45, 0).map(fixMatrixValue)).toEqual([
    0.70711, 0.5, 0.5, 0, 0, 0.70711, -0.70711, 0, -0.70711, 0.5, 0.5, 0, 0, 0, 0, 1,
  ]);
});

test("generate ZYX rotation function with destination array", () => {
  const rotationMatrix = generateRotationMatrix([], rotZ, rotY, rotX);
  const rotate = generateRotationFunctionWithDest(rotationMatrix);
  const r = identity();
  rotate(r, 45, 0, 0);

  expect(r.map(fixMatrixValue)).toEqual([
    1, 0, 0, 0, 0, 0.70711, -0.70711, 0, 0, 0.70711, 0.70711, 0, 0, 0, 0, 1,
  ]);

  rotate(r, 45, 45, 0);
  expect(r.map(fixMatrixValue)).toEqual([
    0.70711, 0.5, 0.5, 0, 0, 0.70711, -0.70711, 0, -0.70711, 0.5, 0.5, 0, 0, 0, 0, 1,
  ]);
});

test("generate XYZ rotation function", () => {
  const rotationMatrix = generateRotationMatrix([], rotX, rotY, rotZ);
  const rotate = generateRotationFunction(rotationMatrix);

  expect(rotate(45, 0, 0).map(fixMatrixValue)).toEqual([
    1, 0, 0, 0, 0, 0.70711, -0.70711, 0, 0, 0.70711, 0.70711, 0, 0, 0, 0, 1,
  ]);

  expect(rotate(45, 45, 0).map(fixMatrixValue)).toEqual([
    0.70711, 0, 0.70711, 0, 0.5, 0.70711, -0.5, 0, -0.5, 0.70711, 0.5, 0, 0, 0, 0, 1,
  ]);
});

function fixMatrixValue(v) {
  return v === -0 ? 0 : matrixFloatPrecision(v);
}
