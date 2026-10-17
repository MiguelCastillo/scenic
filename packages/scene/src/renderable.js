import {mat4} from "@scenic/math";

import {encloseBoxes} from "./bounds.js";
import {Node} from "./node.js";
import {Viewport} from "./viewport.js";

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
      // The box around what the renderable's geometries draw, {min, max},
      // in its own space, or null without any: the boxes they measured when
      // they were built, put together as they are added and removed, so that
      // drawing never measures anything. The view places it with the
      // renderable's world matrix to see whether it can be in view.
      this.localBox = null;
    }

    // A child with a buffer of its own, such as a Geometry, adds the box it
    // measured to the renderable's, such as each level of detail of a mesh.
    // Other children, such as a renderable under it, are placed by their own
    // transforms, and keep their own boxes.
    add(node) {
      super.add(node);
      if (node.vertexBuffer) {
        this.localBox = encloseBoxes(this.localBox, node.localBox);
      }
      return this;
    }

    // Removing a child with a buffer puts the renderable's box together again
    // from the ones left.
    remove(node) {
      super.remove(node);
      if (node.vertexBuffer) {
        this.localBox = this.items
          .filter((child) => child.vertexBuffer)
          .reduce((box, child) => encloseBoxes(box, child.localBox), null);
      }
      return this;
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

    // getViewProjectionMatrix is the view-projection of the closest parent
    // Viewport, which takes this renderable from world space to clip space.
    getViewProjectionMatrix() {
      const viewport = this.getViewport();
      return viewport ? viewport.viewProjectionMatrix : _identity;
    }

    // getViewUniforms are the view uniforms of the closest parent Viewport,
    // such as the camera position and fog. See Viewport.viewUniforms.
    getViewUniforms() {
      const viewport = this.getViewport();
      return viewport ? viewport.viewUniforms : [];
    }

    getViewport() {
      let viewport = this;
      while (viewport && !(viewport instanceof Viewport)) {
        viewport = viewport.parent;
      }

      return viewport;
    }
  };

export class Renderable extends RenderableInterface(Node) {
  constructor(options) {
    super(options);
  }
}
