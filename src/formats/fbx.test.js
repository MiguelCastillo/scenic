import fs from "fs";
import path from "path";
import {
  FbxFile,
  Node,
  findPropertyValueByName,
  findChildByName,
  findChildrenByName,
  triangulatePolygonIndexes,
  mapIndexByPolygonVertex,
} from "./fbxfile.js";

import {
  getTriangleComponents,
  getIndexed2DComponents,
  normalizeTriangleVertices,
} from "../math/geometry.js";

test("parse binary cube", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);
  expect(findPropertyValueByName(model, "CreationTime")).toEqual("1970-01-01 10:00:00:000");
  expect(findPropertyValueByName(model, "Creator")).toEqual("Blender (stable FBX IO) - 3.0.0 - 4.27.0");

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();
  expect(objects.children).toHaveLength(3);

  const geometry = findChildByName(objects, "Geometry");
  expect(geometry).not.toBeUndefined();

  const edges = findPropertyValueByName(geometry, "Edges");
  expect(edges).toEqual([0, 1, 2, 3, 4, 6, 7, 10, 11, 12, 13, 16]);

  const vertices = findPropertyValueByName(geometry, "Vertices");
  expect(vertices).toEqual([
     1,  1,  1, // v0
     1,  1, -1, // v1
     1, -1,  1, // v2
     1, -1, -1, // v3
    -1,  1,  1, // v4
    -1,  1, -1, // v5
    -1, -1,  1, // v6
    -1, -1, -1, // v7
  ]);

  const polygonVertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
  expect(polygonVertexIndex).toEqual([
    0, 4, 6, -3, // ti0,  ti1
    3, 2, 6, -8, // ti2,  ti3
    7, 6, 4, -6, // ti4,  ti5
    5, 1, 3, -8, // ti6,  ti7
    1, 0, 2, -4, // ti8,  ti9
    5, 4, 0, -2, // ti10, ti11
  ]);

  const triangulatedIndexes = triangulatePolygonIndexes(polygonVertexIndex);
  expect(triangulatedIndexes).toEqual([
    0, 4, 6, // ti0 
    0, 6, 2, // ti1
    3, 2, 6, // ti2
    3, 6, 7, // ti3
    7, 6, 4, // ti4
    7, 4, 5, // ti5
    5, 1, 3, // ti6
    5, 3, 7, // ti7
    1, 0, 2, // ti8
    1, 2, 3, // ti9
    5, 4, 0, // ti10
    5, 0, 1, // ti11
  ]);

  const normalLayer = findChildByName(geometry, "LayerElementNormal");
  expect(normalLayer).not.toBeUndefined();

  const normals = findPropertyValueByName(normalLayer, "Normals");
  expect(normals).toEqual([
    0,0,1,
    0,0,1,
    0,0,1,
    0,0,1,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    1,0,0,
    1,0,0,
    1,0,0,
    1,0,0,
    0,1,0,
    0,1,0,
    0,1,0,
    0,1,0,
  ]);

  // NOTE: normalizeTriangleVertices returns non smoothed normals, but
  // usually FBX files will contain smoothed normals.
  // This tests works fine for a cube because smoothing of the normals
  // will yield the same normals as non smoothed ones.
  const normalIndexes = mapIndexByPolygonVertex(polygonVertexIndex);
  expect(getTriangleComponents(normals, normalIndexes))
    .toEqual(normalizeTriangleVertices(
      getTriangleComponents(vertices, triangulatedIndexes)));

  const UVLayer = findChildByName(geometry, "LayerElementUV");
  expect(UVLayer).not.toBeUndefined();

  const UV = findPropertyValueByName(UVLayer, "UV");
  expect(UV).toEqual([
    0.625, 1,      // 0
    0.625, 0.25,   // 1
    0.375, 0.5,    // 2
    0.875, 0.5,    // 3
    0.625, 0.75,   // 4
    0.375, 1,      // 5
    0.375, 0.75,   // 6
    0.625, 0,      // 7
    0.375, 0,      // 8
    0.375, 0.25,   // 9
    0.125, 0.5,    // 10
    0.875, 0.75,   // 11
    0.125, 0.75,   // 12
    0.625, 0.5,    // 13
  ]);

  const UVIndex = findPropertyValueByName(UVLayer, "UVIndex");
  expect(UVIndex).toEqual([
    13, 3,
    11, 4,
    6,  4,
    0,  5,
    8,  7,
    1,  9,
    10, 2,
    6,  12,
    2,  13,
    4,  6,
    9,  1,
    13, 2,
  ]);

  const UVCoordinates = getIndexed2DComponents(UV, UVIndex);
  expect(UVCoordinates).toEqual([
    0.625, 0.5,    // 13
    0.875, 0.5,    // 3

    0.875, 0.75,   // 11
    0.625, 0.75,   // 4

    0.375, 0.75,   // 6
    0.625, 0.75,   // 4

    0.625, 1,      // 0
    0.375, 1,      // 5

    0.375, 0,      // 8
    0.625, 0,      // 7

    0.625, 0.25,   // 1
    0.375, 0.25,   // 9

    0.125, 0.5,    // 10
    0.375, 0.5,    // 2

    0.375, 0.75,   // 6
    0.125, 0.75,   // 12

    0.375, 0.5,    // 2
    0.625, 0.5,    // 13

    0.625, 0.75,   // 4
    0.375, 0.75,   // 6

    0.375, 0.25,   // 9
    0.625, 0.25,   // 1

    0.625, 0.5,    // 13
    0.375, 0.5,    // 2
  ]);

  const UVForTriangle = getIndexed2DComponents(UVCoordinates, mapIndexByPolygonVertex(polygonVertexIndex));
  expect(UVForTriangle).toEqual([
    0.625,  0.5,
    0.875,  0.5,
    0.875, 0.75,

    0.625,  0.5,
    0.875, 0.75,
    0.625, 0.75,

    0.375, 0.75,
    0.625, 0.75,
    0.625,    1,

    0.375, 0.75,
    0.625,    1,
    0.375,    1,

    0.375,    0,
    0.625,    0,
    0.625, 0.25,

    0.375,    0,
    0.625, 0.25,
    0.375, 0.25,

    0.125,  0.5,
    0.375,  0.5,
    0.375, 0.75,

    0.125,  0.5,
    0.375, 0.75,
    0.125, 0.75,

    0.375,  0.5,
    0.625,  0.5,
    0.625, 0.75,

    0.375,  0.5,
    0.625, 0.75,
    0.375, 0.75,

    0.375, 0.25,
    0.625, 0.25,
    0.625,  0.5,

    0.375, 0.25,
    0.625,  0.5,
    0.375,  0.5,
  ]);
});

test("match calculated normals to normals from file", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();

  for (const geometry of findChildrenByName(objects, "Geometry")) {
    expect(geometry).not.toBeUndefined();

    const vertices = findPropertyValueByName(geometry, "Vertices");
    expect(vertices).not.toBeUndefined();

    const normalLayer = findChildByName(geometry, "LayerElementNormal");
    expect(normalLayer).not.toBeUndefined();
    const normals = findPropertyValueByName(normalLayer, "Normals");

    const polygonVertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
    const normalIndexes = mapIndexByPolygonVertex(polygonVertexIndex);
    const vertexIndexes = triangulatePolygonIndexes(polygonVertexIndex);

    const a = getTriangleComponents(normals, normalIndexes);
    const b = normalizeTriangleVertices(getTriangleComponents(vertices, vertexIndexes));
    expect(a).toEqual(b);
  }
});

test("iterate connections", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);

  const objectsByID = {};
  const objects = findChildByName(model, "Objects");
  for (let i = 0; i < objects.children.length; i++) {
    const obj = objects.children[i];
    objectsByID[obj.attributes[0]] = obj;
  }

  expect(Object.keys(objectsByID)).toEqual([
    "123698400,0",
    "535348117,0",
    "318760608,0",
  ]);

  const connectionsByID = {};
  const connections = findChildByName(model, "Connections");
  for (let i = 0; i < connections.properties.length; i++) {
    const propertyValue = connections.properties[i].value;
    connectionsByID[propertyValue[1]] = propertyValue;
  }

  expect(Object.keys(connectionsByID)).toEqual([
    "535348117,0",
    "123698400,0",
    "318760608,0",
  ]);

  expect(connectionsByID["535348117,0"][2]).toEqual([0, 0]); // 0,0 is a root document.
  expect(connectionsByID["123698400,0"][2]).toEqual([535348117,0]);
  expect(connectionsByID["318760608,0"][2]).toEqual([535348117,0]);

  expect(objectsByID["123698400,0"].name).toEqual("Geometry")
  expect(objectsByID["318760608,0"].name).toEqual("Material")
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
