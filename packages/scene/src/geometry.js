import {BoundingBox} from "./bounds.js";
import {Node} from "./node.js";

// Geometry owns a vertex buffer, which its parent renderable reads to draw
// (see prepareForView in Mesh). The renderable only draws the buffer, so it
// is deleted here when the geometry is disposed.
//
// It measures its buffer's bounding volume when it is built, around its
// positions, in its own space, or null for a buffer without positions. Its
// renderable keeps the bounding volume around all of its geometries (see
// Renderable).
export class Geometry extends Node {
  constructor(options, vertexBuffer) {
    super({type: "geometry", ...options});
    this.vertexBuffer = vertexBuffer;
    this.boundingVolume = vertexBuffer?.positions
      ? BoundingBox.around(vertexBuffer.positions.data)
      : null;
  }

  dispose(gl) {
    this.vertexBuffer.dispose();
    super.dispose(gl);
  }
}
