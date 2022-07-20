import {mat4} from "@scenic/math";
import {Node} from "./node.js";
import {Projection} from "./projection.js";

const _identity = mat4.Matrix4.identity();

// Renderable is a node type that provides an interface for specifying shader
// program, vertex buffers, and projection matrices. This is gives us all the
// usually parts needed to render a node. If your node needs to be able to
// render children nodes then you will needs these things, so very likely you
// will want to use this interface.
export const RenderableInterface = (superclass) =>
  class extends superclass {
    constructor(options) {
      super(options);
      // We will default to a type but often inheriting classes will specify
      // their own. So we will allow overriding the `type` field.
      this.vertexBuffers = [];
    }

    withShaderProgram(shaderProgram) {
      this.shaderProgram = shaderProgram.clone();
      return this;
    }

    addVertexBuffer(vertexBuffer) {
      this.vertexBuffers.push(vertexBuffer);
      return this;
    }

    getProjectionMatrix() {
      let projectionNode = this;
      while (projectionNode && !(projectionNode instanceof Projection)) {
        projectionNode = projectionNode.parent;
      }

      return projectionNode ? projectionNode.projectionMatrix : _identity;
    }
  };

export class Renderable extends RenderableInterface(Node) {
  constructor(options) {
    super(options);
  }
}
