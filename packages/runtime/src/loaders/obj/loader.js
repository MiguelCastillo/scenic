import {geometry as geo} from "@scenic/math";
import {TextureVertexBufferData, VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Geometry as GeometrySceneNode} from "@scenic/scene";

import {WorkerLoader} from "../base-loader.js";
import {isLight, isStaticMesh, isSkinnedMesh} from "../../scene-factory.js";

/**
 * File loader for obj formatted files.
 */
export class Loader extends WorkerLoader {
  constructor() {
    super(new Worker("/packages/runtime/src/loaders/obj/worker.js"));
  }
}

// buildSceneNode adds the model to sceneNode as a geometry child. A static
// mesh with lods (see getResourcesFromConfig) gets one for its resource and
// one for each of its lods, lodDistance being the distance from the camera a
// lod takes over from, and the mesh draws the one for how far away it is. A
// geometry it already has for the same lod is replaced.
export function buildSceneNode(gl, model, sceneNode, sceneManager, lodDistance) {
  const name = lodDistance == null ? "geometry" : `geometry lod ${lodDistance}`;
  const previous = sceneNode.items.find((child) => child.name === name);
  if (previous) {
    sceneNode.remove(previous);
    previous.dispose(gl);
  }
  let {vertices, normals, colors, textures} = model;

  const hasNormals = normals.byteLength || normals.length;
  const hasColors = colors.byteLength || colors.length;
  // Texture coordinates, from the model's vt lines, for a mesh with a
  // texture (see textures on a static mesh in the README).
  const hasTextures = textures?.byteLength || textures?.length;
  const vertexBuffer = new VertexBuffer({
    positions: new VertexBufferData(gl, vertices),
    normals: new VertexBufferData(
      gl,
      hasNormals ? normals : geo.normalizeTriangleVertices(new Float32Array(vertices))
    ),
    colors: hasColors ? new VertexBufferData(gl, colors) : undefined,
    textureCoords: hasTextures ? new TextureVertexBufferData(gl, textures) : undefined,
  });

  if (!isStaticMesh(sceneNode) && !isSkinnedMesh(sceneNode) && !isLight(sceneNode)) {
    throw new Error("OBJ files can only be loaded into a static-mesh, skinned-mesh or light");
  }

  // A mesh with lods draws its own resource only until its first lod takes
  // over, from the camera.
  const hasLods = !!sceneManager?.getNodeStateByID(sceneNode.id)?.lods?.length;
  if (lodDistance != null || hasLods) {
    vertexBuffer.lodDistance = lodDistance ?? 0;
  }

  // The geometry child owns the vertex buffer and adds it to this node's draw
  // list every frame. The node's shader program is created afterwards, by the
  // shader registry.
  sceneNode.add(new GeometrySceneNode({name}, vertexBuffer));
}
