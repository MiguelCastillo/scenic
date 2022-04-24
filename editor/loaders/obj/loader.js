import {normalizeTriangleVertices} from "../../../src/math/geometry.js";

import {VertexBuffer, VertexBufferData} from "../../../src/renderer/vertexbuffer.js";

import {WorkerLoader} from "../base-loader.js";

import {isLight, isStaticMesh} from "../../scene-factory.js";

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
  let {vertices, normals, colors} = model;

  const vertexBuffer = VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
  });

  if (!normals.byteLength && !normals.length) {
    vertexBuffer.withNormals(
      new VertexBufferData(gl, normalizeTriangleVertices(new Float32Array(vertices)))
    );
  } else {
    vertexBuffer.withNormals(new VertexBufferData(gl, normals));
  }

  if (colors.byteLength || colors.length) {
    vertexBuffer.withColors(new VertexBufferData(gl, colors));
  }

  let shaderProgram;
  if (isStaticMesh(sceneNode)) {
    shaderProgram = createShaderProgram(gl, "phong-lighting");
  } else if (isLight(sceneNode)) {
    shaderProgram = createShaderProgram(gl, "flat-material");
  } else {
    throw new Error(
      "Unable to intialize shader program because node is not a static-mesh or light"
    );
  }

  sceneNode.withVertexBuffer(vertexBuffer).withShaderProgram(shaderProgram);
}
