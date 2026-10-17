import {BoundingBox} from "./bounds.js";
import {Node} from "./node.js";
import {Renderable} from "./renderable.js";

// Geometry owns a vertex buffer and adds it to the closest parent renderable's
// draw list every frame. The renderable only draws the buffer, so it is
// deleted here when the geometry is disposed.
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

  render() {
    const renderable = Node.findParentByType(this, Renderable);
    if (renderable) {
      renderable.addVertexBuffer(this.vertexBuffer);
    }
  }

  dispose(gl) {
    this.vertexBuffer.dispose();
    super.dispose(gl);
  }
}
