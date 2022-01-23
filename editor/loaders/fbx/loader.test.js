
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
