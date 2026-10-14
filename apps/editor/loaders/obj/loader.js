import {geometry as geo} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Geometry as GeometrySceneNode} from "@scenic/scene";

import {WorkerLoader} from "../base-loader.js";
import {isLight, isStaticMesh, isSkinnedMesh} from "../../scene-factory.js";

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

  if (!isStaticMesh(sceneNode) && !isSkinnedMesh(sceneNode) && !isLight(sceneNode)) {
    throw new Error("OBJ files can only be loaded into a static-mesh, skinned-mesh or light");
  }

  // The geometry child owns the vertex buffer and adds it to this node's draw
  // list every frame. The node's shader program is created afterwards, by the
  // shader registry.
  sceneNode.add(new GeometrySceneNode({name: "geometry"}, vertexBuffer));
}
