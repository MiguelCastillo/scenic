import fs from "fs";
import path from "path";
import {
  FbxFile,
  Node,
  findPropertyValueByName,
  findChildByName,
  findChildrenByName,
  decodePolygonVertexIndexes,
  polygonVertexIndexToDirect,
} from "./fbxfile.js";

import {
  getIndexed3DComponents,
  getIndexed2DComponents,
  normalizeTriangleVertices,
} from "../math/geometry.js";

test("parse binary cube", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/__testdata__/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);
  expect(findPropertyValueByName(model, "CreationTime")).toEqual("1970-01-01 10:00:00:000");
  expect(findPropertyValueByName(model, "Creator")).toEqual(
    "Blender (stable FBX IO) - 3.0.0 - 4.27.0"
  );

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();
  expect(objects.children).toHaveLength(3);

  const geometry = findChildByName(objects, "Geometry");
  expect(geometry).not.toBeUndefined();

  const edges = findPropertyValueByName(geometry, "Edges");
  expect(edges).toEqual([0, 1, 2, 3, 4, 6, 7, 10, 11, 12, 13, 16]);

  const vertices = findPropertyValueByName(geometry, "Vertices");

  // prettier-ignore
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

  // prettier-ignore
  expect(polygonVertexIndex).toEqual([
    0, 4, 6, -3, // ti0,  ti1
    3, 2, 6, -8, // ti2,  ti3
    7, 6, 4, -6, // ti4,  ti5
    5, 1, 3, -8, // ti6,  ti7
    1, 0, 2, -4, // ti8,  ti9
    5, 4, 0, -2, // ti10, ti11
  ]);

  const normalLayer = findChildByName(geometry, "LayerElementNormal");
  expect(normalLayer).not.toBeUndefined();

  const normals = findPropertyValueByName(normalLayer, "Normals");

  // prettier-ignore
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

  const UVLayer = findChildByName(geometry, "LayerElementUV");
  expect(UVLayer).not.toBeUndefined();

  const UV = findPropertyValueByName(UVLayer, "UV");

  // prettier-ignore
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

  // prettier-ignore
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

  // prettier-ignore
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
});

test("match calculated normals to normals from file", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/__testdata__/cube.fbx"));
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
    const normalIndexes = polygonVertexIndexToDirect(polygonVertexIndex);
    const vertexIndexes = decodePolygonVertexIndexes(polygonVertexIndex);

    const a = getIndexed3DComponents(normals, normalIndexes);
    const b = normalizeTriangleVertices(getIndexed3DComponents(vertices, vertexIndexes));
    expect(a).toEqual(b);
  }
});

test("iterate connections", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../resources/fbx/__testdata__/cube.fbx"));
  const model = FbxFile.fromBinary(file.buffer);

  const objectsByID = {};
  const objects = findChildByName(model, "Objects");
  for (let i = 0; i < objects.children.length; i++) {
    const obj = objects.children[i];
    objectsByID[obj.attributes[0]] = obj;
  }

  expect(Object.keys(objectsByID)).toEqual(["123698400,0", "535348117,0", "318760608,0"]);

  const connectionsByID = {};
  const connections = findChildByName(model, "Connections");
  for (let i = 0; i < connections.properties.length; i++) {
    const propertyValue = connections.properties[i].value;
    connectionsByID[propertyValue[1]] = propertyValue;
  }

  expect(Object.keys(connectionsByID)).toEqual(["535348117,0", "123698400,0", "318760608,0"]);

  expect(connectionsByID["535348117,0"][2]).toEqual([0, 0]); // 0,0 is a root document.
  expect(connectionsByID["123698400,0"][2]).toEqual([535348117, 0]);
  expect(connectionsByID["318760608,0"][2]).toEqual([535348117, 0]);

  expect(objectsByID["123698400,0"].name).toEqual("Geometry");
  expect(objectsByID["318760608,0"].name).toEqual("Material");
});

test("parse binary cube7500", () => {
  const file = fs.readFileSync(
    path.join(__dirname, "../../resources/fbx/__testdata__/cube7500.fbx")
  );
  const model = FbxFile.fromBinary(file.buffer);
  expect(model).toBeInstanceOf(Node);
  expect(findPropertyValueByName(model, "CreationTime")).toEqual("2018-11-27 08:12:37:098");
  expect(findPropertyValueByName(model, "Creator")).toEqual(
    "FBX SDK/FBX Plugins version 2016.1.2 build=20150910"
  );

  const objects = findChildByName(model, "Objects");
  expect(objects).not.toBeUndefined();
  expect(objects.children).toHaveLength(5);

  const geometry = findChildByName(objects, "Geometry");
  expect(geometry).not.toBeUndefined();
  expect(findPropertyValueByName(geometry, "Vertices")).toEqual([
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5,
  ]);
  expect(findPropertyValueByName(geometry, "PolygonVertexIndex")).toEqual([
    0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5,
  ]);
  expect(findPropertyValueByName(geometry, "Edges")).toEqual([
    0, 2, 6, 10, 3, 1, 7, 5, 11, 9, 15, 13,
  ]);

  const triangulatedIndexes = decodePolygonVertexIndexes(
    findPropertyValueByName(geometry, "PolygonVertexIndex")
  );
  // prettier-ignore
  expect(triangulatedIndexes).toEqual([
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
  ]);
});

test("decodePolygonVertexIndexes for a quad", () => {
  const polygonIndexes = [8, 7, 3, -7];
  const triangulatedIndexes = decodePolygonVertexIndexes(polygonIndexes);
  expect(triangulatedIndexes).toEqual([8, 7, 3, 8, 3, 6]);
});

test("decodePolygonVertexIndexes for a cube", () => {
  const polygonIndexes = [
    0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5,
  ];
  const triangulatedIndexes = decodePolygonVertexIndexes(polygonIndexes);

  // prettier-ignore
  expect(triangulatedIndexes).toEqual([
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
  ]);
});

test("render by unpacked polygon index mind bender", () => {
  // prettier-ignore
  const vertices = [
     1,  1,  1, // v0
     1,  1, -1, // v1
     1, -1,  1, // v2
     1, -1, -1, // v3
    -1,  1,  1, // v4
    -1,  1, -1, // v5
    -1, -1,  1, // v6
    -1, -1, -1, // v7
  ];

  // prettier-ignore
  const polygonVertexIndex = [
    0, 4, 6, -3, // ti0,  ti1
    3, 2, 6, -8, // ti2,  ti3
    7, 6, 4, -6, // ti4,  ti5
    5, 1, 3, -8, // ti6,  ti7
    1, 0, 2, -4, // ti8,  ti9
    5, 4, 0, -2, // ti10, ti11
  ];

  const triangulatedIndexes = decodePolygonVertexIndexes(polygonVertexIndex);

  // prettier-ignore
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

  const reindexedPolygonIndexes = polygonVertexIndexToDirect(polygonVertexIndex);

  // prettier-ignore
  expect(reindexedPolygonIndexes).toEqual([
     0,  1,  2,  // ti0
     0,  2,  3,  // ti1
     4,  5,  6,  // ti2
     4,  6,  7,  // ti3
     8,  9, 10,  // ti4
     8, 10, 11,  // ti5
    12, 13, 14,  // ti6
    12, 14, 15,  // ti7
    16, 17, 18,  // ti8
    16, 18, 19,  // ti9
    20, 21, 22,  // ti10
    20, 22, 23,  // ti11
  ]);

  // When we read these vertices for the triangles, we will store the
  // vertices in the order in which they are indexed.
  // So we need to reindex UV and normals coordinates so that the first
  // vertex points to the correct UV and Normal.
  const trianglesVertices = getIndexed3DComponents(vertices, triangulatedIndexes);

  // prettier-ignore
  expect(trianglesVertices).toEqual([
     1,  1,  1, // v0
    -1,  1,  1, // v4
    -1, -1,  1, // v6

     1,  1,  1, // v0
    -1, -1,  1, // v6
     1, -1,  1, // v2

     1, -1, -1, // v3
     1, -1,  1, // v2
    -1, -1,  1, // v6

     1, -1, -1, // v3
    -1, -1,  1, // v6
    -1, -1, -1, // v7

    -1, -1, -1, // v7
    -1, -1,  1, // v6
    -1,  1,  1, // v4

    -1, -1, -1, // v7
    -1,  1,  1, // v4
    -1,  1, -1, // v5

    -1,  1, -1, // v5
     1,  1, -1, // v1
     1, -1, -1, // v3

    -1,  1, -1, // v5
     1, -1, -1, // v3
    -1, -1, -1, // v7

     1,  1, -1, // v1
     1,  1,  1, // v0
     1, -1,  1, // v2

     1,  1, -1, // v1
     1, -1,  1, // v2
     1, -1, -1, // v3

    -1,  1, -1, // v5
    -1,  1,  1, // v4
     1,  1,  1, // v0

    -1,  1, -1, // v5
     1,  1,  1, // v0
     1,  1, -1, // v1
  ]);

  // These are direct so they will map directly to the vertices in each
  // polygon.
  //
  // Let's take a second to look at this data. This is for a cube so each
  // side is 90degs. And that also means that each face will share a position
  // in space but because faces at a 90 angle, normals really cant be indexed
  // like vertices to maximize sharing data. And that's because while vertex
  // at 0,0,0 can be shared with multiple triangles, these triangles can face
  // away from each so lighting will require normals to repsent that if the
  // surface is not supposed to be a smooth suface.
  //
  // To illustrate, take a look at polygon index 2. There is a normal for the
  // front quad, the bottom quad, and the right quad. All those quads share
  // coordinate (1, -1,  1), but because the actual faces point in different
  // directions we have to use a different normal for each one of those
  // coordinates if we want lighting to make the cube look like a cube.
  //
  // prettier-ignore
  const normals = [
    // polygon 1
    // [0, 4, 6, 2,] // ti0,  ti1
    0,  0,  1,   // n0
    0,  0,  1,   // n1
    0,  0,  1,   // n2
    0,  0,  1,   // n3

    // Polygon 2
    // [3, 2, 6, 7,] // ti2,  ti3
    0, -1,  0,   // n4
    0, -1,  0,   // n5
    0, -1,  0,   // n6
    0, -1,  0,   // n7

    // Polygon 3
    // [7, 6, 4, 5,] // ti4,  ti5
   -1,  0,  0,   // n8
   -1,  0,  0,   // n9
   -1,  0,  0,   // n10
   -1,  0,  0,   // n11

    // Polygon 4
    // [5, 1, 3, 7,] // ti6,  ti7
    0,  0, -1,   // n12
    0,  0, -1,   // n13
    0,  0, -1,   // n14
    0,  0, -1,   // n15

    // Polygon 5
    // [1, 0, 2, 3,] // ti8,  ti9
    1,  0,  0,   // n16
    1,  0,  0,   // n18
    1,  0,  0,   // n19
    1,  0,  0,   // n20

    // Polygon 6
    // [5, 4, 0, 1,] // ti10, ti11
    0,  1,  0,   // n21
    0,  1,  0,   // n22
    0,  1,  0,   // n23
    0,  1,  0,   // n24
  ];

  const trianglesNormals = getIndexed3DComponents(normals, reindexedPolygonIndexes);

  // prettier-ignore
  expect(trianglesNormals).toEqual([
    0,0,1,
    0,0,1,
    0,0,1,
    0,0,1,
    0,0,1,
    0,0,1,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    0,-1,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    -1,0,0,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    0,0,-1,
    1,0,0,
    1,0,0,
    1,0,0,
    1,0,0,
    1,0,0,
    1,0,0,
    0,1,0,
    0,1,0,
    0,1,0,
    0,1,0,
    0,1,0,
    0,1,0,
  ]);

  // prettier-ignore
  const UVCoordinates = [
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
  ];

  const triangleUVs = getIndexed2DComponents(UVCoordinates, reindexedPolygonIndexes);

  // prettier-ignore
  expect(triangleUVs).toEqual([
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
