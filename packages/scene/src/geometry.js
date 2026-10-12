import {Node} from "./node.js";
import {Renderable} from "./renderable.js";

// Geometry owns a vertex buffer and adds it to the closest parent renderable's
// draw list every frame. The renderable only draws the buffer, so it is
// deleted here when the geometry is disposed.
export class Geometry extends Node {
  constructor(options, vertexBuffer) {
    super({type: "geometry", ...options});
    this.vertexBuffer = vertexBuffer;
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
