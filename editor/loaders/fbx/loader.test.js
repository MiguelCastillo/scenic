import fs from "fs";
import path from "path";
import "webgl-mock";

import {
  FbxFile,
  Node as FbxNode,
} from "../../../src/formats/fbxfile.js";

import {
  buildSceneNode,
} from "./loader.js";

import {
  createScene,
} from "../../scene-factory.js";

const cubdeFilePath = path.join(__dirname, "../../../resources/fbx/cube.fbx");

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
    buildSceneNode(gl, model, sceneNodeFxbCube, sceneManager);

    const sceneNode = sceneManager.getNodeByName("fbx cube")
    expect(sceneNode.items[0].name).toEqual("Cube\u0000\u0001Model_n1");
    expect(sceneNode.items[0].items[0].name).toEqual("Cube\u0000\u0001Geometry_n1");
  });
});
