import {mat4} from "@scenic/math";

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
      // boundingVolume is around everything the renderable's geometries
      // draw, in its own space, or null before it has any (see bounds.js).
      // Each geometry measures its own when it is built; the renderable
      // only puts them together as geometries are added and removed (see
      // add and remove), so nothing is measured while drawing.
      this.boundingVolume = null;
    }

    // add takes in the bounding volume of a child with a buffer of its own,
    // such as a Geometry, which can be one level of detail of a mesh.
    //
    // Other children, such as a renderable under this one, are left out. A
    // child renderable keeps its own bounding volume, from its own
    // geometries, and is checked against the view on its own, placed with
    // its own world matrix (see prepareForView and isBoundingVolumeInView in
    // Mesh), so a child can still be drawn when this renderable is out of
    // view.
    add(node) {
      super.add(node);
      if (node.vertexBuffer && node.boundingVolume) {
        this.boundingVolume = node.boundingVolume.enclosing(this.boundingVolume);
      }
      return this;
    }

    // Removing a child with a buffer puts the renderable's bounding volume
    // together again from the ones left.
    remove(node) {
      super.remove(node);
      if (node.vertexBuffer) {
        this.boundingVolume = this.items
          .filter((child) => child.vertexBuffer && child.boundingVolume)
          .reduce((volume, child) => child.boundingVolume.enclosing(volume), null);
      }
      return this;
    }

    withShaderProgram(shaderProgram) {
      this.shaderProgram = shaderProgram.clone();
      return this;
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
