import {geometry as geo} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Geometry as GeometrySceneNode} from "@scenic/scene";

import {WorkerLoader} from "../base-loader.js";
import {isLight, isStaticMesh, isSkinnedMesh} from "../../scene-factory.js";
import {createShaderProgram} from "../../shader-factory.js";

/**
 * File loader for obj formatted files.
 */
export class Loader extends WorkerLoader {
  constructor() {
    super(new Worker("/apps/editor/loaders/obj/worker.js"));
  }
}

export function buildSceneNode(gl, model, sceneNode /*, sceneManager*/) {
  // Release the GPU resources from a previous build before replacing them.
  sceneNode.dispose(gl);
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
    shaderProgram = createShaderProgram(gl, "shaders/phong-lighting");
  } else if (isLight(sceneNode)) {
    shaderProgram = createShaderProgram(gl, "shaders/flat-material");
  } else {
    throw new Error(
      "Unable to intialize shader program because node is not a static-mesh or light"
    );
  }

  // The geometry child owns the vertex buffer and adds it to this node's draw
  // list every frame.
  sceneNode.add(new GeometrySceneNode({name: "geometry"}, vertexBuffer));
  sceneNode.withShaderProgram(shaderProgram);
}
