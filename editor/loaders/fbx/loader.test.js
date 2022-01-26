
import fs from "fs";
import path from "path";
import "webgl-mock";

import {
  getIndexed3DComponents,
} from "../../../src/math/geometry.js";

import {
  FbxFile,
  convertPolygonIndexesToTriangleIndexes,
  Node as FbxNode,
} from "../../../src/formats/fbxfile.js";

import {
  buildSceneNode,
  traingleIndexesByPolygonVertex,
} from "./loader.js";

import {
  addShaderCacheEntry,
} from "../../shader-factory.js";

import {
  createScene,
} from "../../scene-factory.js";


const cubdeFilePath = path.join(__dirname, "../../../resources/fbx/cube.fbx");

function mockShaders(shaders) {
  shaders.forEach(s => {
    const shaderDir = path.join(__dirname, "../../shaders/");
    addShaderCacheEntry(s,
      fs.readFileSync(shaderDir + s + ".vert") + "",
      fs.readFileSync(shaderDir + s + ".frag") + "",
    );
  });
};

describe("fbx Loader", () => {
  test("loading cube.fbx", () => {
    const file = fs.readFileSync(cubdeFilePath);
    const model = FbxFile.fromBinary(file.buffer);
    expect(model).toBeInstanceOf(FbxNode);

    const sceneNodeFxbCube = {
      name: "fbx cube",
      type: "group",
    };
    const sceneNodeConfig = {
      items: [sceneNodeFxbCube]
    };
    const sceneManager = createScene(sceneNodeConfig);
    const canvas = new HTMLCanvasElement(500, 500);
    const gl = canvas.getContext("webgl");

    mockShaders(["phong-lighting"]);
    buildSceneNode(gl, model, sceneNodeFxbCube, sceneManager);

    const sceneNode = sceneManager.getNodeByName("fbx cube")
    expect(sceneNode.items[0].name).toEqual("Model_Cube_Mesh_n1");
    expect(sceneNode.items[0].items[0].name).toEqual("Geometry_Cube_Mesh_n1");
  });
});

test("unpacked polygon indexes mapped to triangle indexes", () => {
  const vertices = [
    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0
    -0.0882214605808258,-0.05302649736404419,-2.0171525478363037,   // v1
    -0.0882214605808258,1.9469735622406006,-0.01715238019824028,    // v2
    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3
    -2.088221311569214,1.9469735622406006,-2.0171525478363037,      // v4
    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6
    -2.088221311569214,-0.05302649736404419,-0.01715238019824028,   // v7
  ];

  const polygonVertexIndex = [
    0, 4, 6, -3, // ti0,  ti1
    3, 2, 6, -8, // ti2,  ti3
    7, 6, 4, -6, // ti4,  ti5
    5, 1, 3, -8, // ti6,  ti7
    1, 0, 2, -4, // ti8,  ti9
    5, 4, 0, -2, // ti10, ti11
  ];

  const triangulatedIndexes = convertPolygonIndexesToTriangleIndexes(polygonVertexIndex);
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

  // When we read these vertices for the triangles, we will store the
  // vertices in the order in which they are indexed.
  // So we need to reindex UV and normals coordinates so that the first
  // vertex points to the correct UV and Normal.
  const trianglesVertices = getIndexed3DComponents(vertices, triangulatedIndexes);
  expect(trianglesVertices).toEqual([
    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0
    -2.088221311569214,1.9469735622406006,-2.0171525478363037,      // v4
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6

    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6
    -0.0882214605808258,1.9469735622406006,-0.01715238019824028,    // v2

    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3
    -0.0882214605808258,1.9469735622406006,-0.01715238019824028,    // v2
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6

    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6
    -2.088221311569214,-0.05302649736404419,-0.01715238019824028,   // v7

    -2.088221311569214,-0.05302649736404419,-0.01715238019824028,   // v7
    -2.088221311569214,1.9469735622406006,-0.01715238019824028,     // v6
    -2.088221311569214,1.9469735622406006,-2.0171525478363037,      // v4

    -2.088221311569214,-0.05302649736404419,-0.01715238019824028,   // v7
    -2.088221311569214,1.9469735622406006,-2.0171525478363037,      // v4
    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5

    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5
    -0.0882214605808258,-0.05302649736404419,-2.0171525478363037,   // v1
    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3

    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5
    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3
    -2.088221311569214,-0.05302649736404419,-0.01715238019824028,   // v7

    -0.0882214605808258,-0.05302649736404419,-2.0171525478363037,   // v1
    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0
    -0.0882214605808258,1.9469735622406006,-0.01715238019824028,    // v2

    -0.0882214605808258,-0.05302649736404419,-2.0171525478363037,   // v1
    -0.0882214605808258,1.9469735622406006,-0.01715238019824028,    // v2
    -0.0882214605808258,-0.05302649736404419,-0.01715238019824028,  // v3

    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5
    -2.088221311569214,1.9469735622406006,-2.0171525478363037,      // v4
    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0

    -2.088221311569214,-0.05302649736404419,-2.0171525478363037,    // v5
    -0.0882214605808258,1.9469735622406006,-2.0171525478363037,     // v0
    -0.0882214605808258,-0.05302649736404419,-2.0171525478363037,   // v1
  ]);

  const remappedPolygonIndexes = traingleIndexesByPolygonVertex(triangulatedIndexes);
  expect(remappedPolygonIndexes).toEqual({
    "0": 0,
    "1": 19,
    "2": 5,
    "3": 6,
    "4": 1,
    "5": 17,
    "6": 2,
    "7": 11,
  });
});
