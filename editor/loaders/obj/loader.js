import {geometry as geo} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "../../../packages/renderer/vertexbuffer.js";
import {WorkerLoader} from "../base-loader.js";
import {isLight, isStaticMesh, isSkinnedMesh} from "../../scene-factory.js";
import {createShaderProgram} from "../../shader-factory.js";

/**
 * File loader for obj formatted files.
 */
export class Loader extends WorkerLoader {
  constructor() {
    super(new Worker("/editor/loaders/obj/worker.js"));
  }
}

export function buildSceneNode(gl, model, sceneNode /*, sceneManager*/) {
  sceneNode.clear();
  let {vertices, normals, colors} = model;

  const vertexBuffer = VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
  });

  if (!normals.byteLength && !normals.length) {
    vertexBuffer.withNormals(
      new VertexBufferData(gl, geo.normalizeTriangleVertices(new Float32Array(vertices)))
    );
  } else {
    vertexBuffer.withNormals(new VertexBufferData(gl, normals));
  }

  if (colors.byteLength || colors.length) {
    vertexBuffer.withColors(new VertexBufferData(gl, colors));
  }

  let shaderProgram;
  if (isStaticMesh(sceneNode) || isSkinnedMesh(sceneNode)) {
    shaderProgram = createShaderProgram(gl, "phong-lighting");
  } else if (isLight(sceneNode)) {
    shaderProgram = createShaderProgram(gl, "flat-material");
  } else {
    throw new Error(
      "Unable to intialize shader program because node is not a static-mesh or light"
    );
  }

  sceneNode.addVertexBuffer(vertexBuffer).withShaderProgram(shaderProgram);
}
