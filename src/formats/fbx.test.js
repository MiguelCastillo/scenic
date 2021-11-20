import fs from "fs";
import path from "path";
import {
  FbxFile,
  Node,
  findPropertyValueByName,
  findChildByName,
  triangulatePolygonIndexes,
} from "./fbxfile.js";

test("parse binary cube", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);
  expect(findPropertyValueByName(model, "CreationTime")).toEqual("1970-01-01 10:00:00:000");
  expect(findPropertyValueByName(model, "Creator")).toEqual("Blender (stable FBX IO) - 2.93.4 - 4.22.0");

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();
  expect(objects.children).toHaveLength(2);

  const geometry = findChildByName(objects, "Geometry");
  expect(geometry).not.toBeUndefined();
  expect(findPropertyValueByName(geometry, "Vertices")).toEqual([1, 1, 1, 1, 1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, 1, -1, -1, -1]);
  expect(findPropertyValueByName(geometry, "PolygonVertexIndex")).toEqual([0, 4, 6, -3, 3, 2, 6, -8, 7, 6, 4, -6, 5, 1, 3, -8, 1, 0, 2, -4, 5, 4, 0, -2]);
  expect(findPropertyValueByName(geometry, "Edges")).toEqual([0, 1, 2, 3, 4, 6, 7, 10, 11, 12, 13, 16]);

  // [0, 4, 6, -3, 3, 2, 6, -8, 7, 6, 4, -6, 5, 1, 3, -8, 1, 0, 2, -4, 5, 4, 0, -2]
  const triangulatedIndexes = triangulatePolygonIndexes(findPropertyValueByName(geometry, "PolygonVertexIndex"));
  expect(triangulatedIndexes).toEqual(
    [
      0, 4, 6,
      0, 6, 2,
      3, 2, 6,
      3, 6, 7,
      7, 6, 4,
      7, 4, 5,
      5, 1, 3,
      5, 3, 7,
      1, 0, 2,
      1, 2, 3,
      5, 4, 0,
      5, 0, 1,
    ]
  )
});

test("parse binary cube7500", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/cube7500.fbx"));
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);
  expect(findPropertyValueByName(model, "CreationTime")).toEqual("2018-11-27 08:12:37:098");
  expect(findPropertyValueByName(model, "Creator")).toEqual("FBX SDK/FBX Plugins version 2016.1.2 build=20150910");

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();
  expect(objects.children).toHaveLength(5);

  const geometry = findChildByName(objects, "Geometry");
  expect(geometry).not.toBeUndefined();
  expect(findPropertyValueByName(geometry, "Vertices")).toEqual([-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5]);
  expect(findPropertyValueByName(geometry, "PolygonVertexIndex")).toEqual([0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5]);
  expect(findPropertyValueByName(geometry, "Edges")).toEqual([0, 2, 6, 10, 3, 1, 7, 5, 11, 9, 15, 13]);

  const triangulatedIndexes = triangulatePolygonIndexes(findPropertyValueByName(geometry, "PolygonVertexIndex"));
  expect(triangulatedIndexes).toEqual(
    [
      0, 1, 3,
      0, 3, 2,
      2, 3, 5,
      2, 5, 4,
      4, 5, 7,
      4, 7, 6,
      6, 7, 1,
      6, 1, -0,
      1, 7, 5,
      1, 5, 3,
      6, 0, 2,
      6, 2, 4,
    ]
  )
});
