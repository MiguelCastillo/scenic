import * as mat4 from "../math/matrix4.js";
import {Node} from "./node.js";
import {Projection} from "./projection.js";

// Renderable is a node type that provides an interface for specifying shader
// program, vertex buffers, and projection matrices. This is gives us all the
// usually parts needed to render a node. If your node needs to be able to
// render children nodes then you will needs these things, so very likely you
// will want to use this interface.
export class Renderable extends Node {
  constructor(options) {
    // We will default to a type but often inheriting classes will specify
    // their own. So we will allow overriding the `type` field.
    super({type: "renderable", ...options});
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram.clone();
    return this;
  }

  withVertexBuffer(vertexBuffer) {
    this.vertexBuffer = vertexBuffer;
    return this;
  }

  getProjectionMatrix() {
    let projectionNode = this;
    while (projectionNode && !(projectionNode instanceof Projection)) {
      projectionNode = projectionNode.parent;
    }

    return projectionNode ?
      projectionNode.projectionMatrix :
      mat4.Matrix4.identity();
  }
}
