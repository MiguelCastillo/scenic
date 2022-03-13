
import fs from "fs";
import path from "path";
import "webgl-mock";

import {fixedFloat} from "../../../src/math/float.js";
import * as mat4 from "../../../src/math/matrix4.js";

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

import {
  bubbleTraversal,
} from "../../../src/scene/traversal.js";

const float1 = fixedFloat(1);

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
    const filepath = path.join(__dirname, "../../../resources/fbx/cube.fbx");
    const file = fs.readFileSync(filepath);
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

    const sceneNode = sceneManager.getNodeByName("fbx cube");
    expect(sceneNode.items[0].name).toEqual("Cube - Model_Mesh");
    expect(sceneNode.items[0].items[0].name).toEqual("Cube - Geometry_Mesh");
  });

  describe("cube armature animation", () => {
    const filepath = path.join(__dirname, "../../../resources/fbx/cubearmature_simple.fbx");
    const file = fs.readFileSync(filepath);
    const model = FbxFile.fromBinary(file.buffer);
    const sceneNodeConfig = {
      items: [{
        name: "cube armature",
        type: "group",
      }]
    };
    const sceneManager = createScene(sceneNodeConfig);
    const canvas = new HTMLCanvasElement(500, 500);
    const gl = canvas.getContext("webgl");

    mockShaders(["phong-lighting"]);
    buildSceneNode(gl, model, sceneNodeConfig.items[0], sceneManager);

    sceneManager.updateNodeStateByName("Animation_n0", {
      stackName: "Armature|ArmatureAction - AnimStack",
    });

    const bubbleDown = (context) => {
      return (node /*, parent*/) => {
        node.preRender(context);
        const _tdata = testData[node.name];
        if (_tdata) {
          _tdata.node = node;
        }
      };
    };

    let testData;

    beforeEach(() => {
      testData = {
        "Armature - Model_Null": {
          "rotation": [-90,0,0],
          "position": [0,0,0],
          "scale": [30,30,30]
        },
        "Bottom Bone - Model_LimbNode": {
          "rotation": [90,0,0],
          "position": [0,0,0],
          "scale": [1,1,1]
        },
        "Bottom Cube - Model_Mesh": {
          "rotation": [-90,0,0],
          "position": [0,0,0],
          "scale": [1,1,1]
        },
        "Bottom Cube - Geometry_Mesh": {
          "position": [0,0,0],
          "rotation": [0,0,0],
          "scale": [1,1,1]
        },
        "Right Bone - Model_LimbNode": {
          "rotation": [0,0,-90],
          "position": [0,1,0],
          "scale": [1,1,1]
        },
        "Right Cube - Model_Mesh": {
          "rotation": [-90,0,90],
          "position": [0,1,0],
          "scale": [1,1,1]
        },
        "Right Cube - Geometry_Mesh": {
          "position": [0,0,0],
          "rotation": [0,0,0],
          "scale": [1,1,1]
        }
      };
    });

    const sceneNode = sceneManager.getNodeByName("cube armature");

    test("all transforms at first framge at 0sec of animation", () => {
      let actual, expected;

      // The first animation pass we are rendering at 0 seconds. So
      // the very first frame should align with the default transforms.
      // The default transforms are in local space, which get converted
      // to world space in the down traversal of the scene where the
      // bone hierarchy is animated and its transforms are propagated
      // to the meshes (skins) they animate.
      let context = {gl, sceneManager, ms: 0};
      bubbleTraversal(bubbleDown(context), () => {})(sceneNode);

      for (const tdata of Object.values(testData)) {
        actual = mat4.Matrix4.identity()
          .translate(...tdata.position)
          .rotate(...tdata.rotation)
          .scale(...tdata.scale);

        // We shorten to 1 floating point because there is a small
        // discrepancy when rotation a matrix via quaternions vs
        // matrix rotation with euler. The difference is just due to
        // floating point subtleties and capping it to 1 is good
        // enough to ensure the values match while avoiding small
        // and insignificant variations.
        actual = tdata.node.parent.worldMatrix.multiply(actual).data.map(float1).map(_fixZeros);
        expected = tdata.node.worldMatrix.data.map(float1).map(_fixZeros);
        expect(expected).toEqual(actual);
      }
    });

    test("right bone transforms at different times in the animation", () => {
      let actual, expected;

      // I extrapolated these time to rotation numbers from the keyframes in
      // blender by looking at the rotation values at these times.
      const timerotation = [
        [250, 28],
        [500, 90],
        [750, 152],
        [1000, 180],
      ];

      // The right bone is rotated along with Y axis. The tricky things about
      // this animation is that the bone is rotated 90 degrees on its Z axis
      // so if there are issues with animation transform logic then rotating on
      // Y will likely break.
      for (const [ms, degrees] of timerotation) {
        let context = {gl, sceneManager, ms};
        bubbleTraversal(bubbleDown(context), () => {})(sceneNode);
        let tdata = testData["Right Bone - Model_LimbNode"];

        actual = mat4.Matrix4.identity()
          .translate(...tdata.position)
          .rotate(...tdata.rotation)
          .rotate(0, degrees, 0)
          .scale(...tdata.scale);

        actual = tdata.node.parent.worldMatrix.multiply(actual).data.map(float1).map(_fixZeros);
        expected = tdata.node.worldMatrix.data.map(float1).map(_fixZeros);
        expect(expected).toEqual(actual);
      }
    });
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

function _fixZeros(v) {
  return v === -0 ? 0 : v;
}
