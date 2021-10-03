import * as vec3 from "../../../src/math/vector3.js";
import {
  VertexBuffer,
  VertexBufferData,
} from "../../../src/renderer/vertexbuffer.js";

import {BaseLoader} from "../base-loader.js";

/**
 * File loader for obj formatted files.
 */
export class Loader extends BaseLoader {
  constructor() {
    super(new Worker("/editor/loaders/obj/worker.js"));
  }
}

export function buildSceneNode(gl, model, node, sceneManager) {
  let {vertices, normals, colors} = model;

  const vertexBuffer = VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
  });

  if (!normals.byteLength && !normals.length) {
    vertexBuffer.withNormals(
      new VertexBufferData(
        gl, vec3.normalizeTriangleVertices(new Float32Array(vertices))));
  }
  else {
    vertexBuffer.withNormals(new VertexBufferData(gl, normals));
  }

  if (colors.byteLength || colors.length) {
    vertexBuffer.withColors(new VertexBufferData(gl, colors));
  }

  sceneManager
    .getNodeByName(node.name)
    .withVertexBuffer(vertexBuffer);
}
