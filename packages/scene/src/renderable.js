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

    // vertexBuffers is the list of buffers to draw this frame. It is cleared
    // in preRender, and child nodes such as Geometry add their buffers to it
    // when they render, which happens before their parent renders. Adding a
    // buffer does not transfer ownership; whoever created it deletes it.
    addVertexBuffer(vertexBuffer) {
      this.vertexBuffers.push(vertexBuffer);
      return this;
    }

    preRender(context) {
      this.vertexBuffers = [];
      super.preRender(context);
    }

    // The renderable owns its shader program, since withShaderProgram keeps a
    // clone of what it is given.
    dispose(gl) {
      if (this.shaderProgram) {
        this.shaderProgram.dispose();
        this.shaderProgram = null;
      }

      super.dispose(gl);
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
