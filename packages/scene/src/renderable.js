import {mat4} from "@scenic/math";

import {Node} from "./node.js";
import {RenderOrder, Viewport} from "./viewport.js";

const _identity = mat4.Matrix4.identity();

// Renderable is a node that draws: it has a shader program, and the view
// and projection of its viewport to draw with. One in view adds itself to
// its viewport's renderablesInView in its prepareForView, and its viewport
// calls its render to draw it, in its renderOrder (see render in
// Viewport).
export const RenderableInterface = (superclass) =>
  class extends superclass {
    constructor(options) {
      super(options);
      // renderOrder is when its viewport renders it, among the other
      // renderables in view (see RenderOrder in viewport.js).
      this.renderOrder = RenderOrder.SOLID;
      // boundingVolume is around everything the renderable's geometries
      // draw, in its own space, or null before it has any (see bounds.js).
      // Each geometry measures its own when it is built; the renderable
      // only puts them together as geometries are added and removed (see
      // add and remove), so nothing is measured while drawing.
      this.boundingVolume = null;
      // vertexBuffers are the buffers of the renderable's geometries, kept as
      // geometries are added and removed (see add and remove), so drawing
      // never has to look for them among its children.
      this.vertexBuffers = [];
    }

    // add takes in the buffer and the bounding volume of a child with a
    // buffer of its own, such as a Geometry, which can be one level of
    // detail of a mesh.
    //
    // Other children, such as a renderable under this one, are left out. A
    // child renderable keeps its own bounding volume, from its own
    // geometries, and is checked against the view on its own, placed with
    // its own world matrix (see prepareForView and isBoundingVolumeInView in
    // Mesh), so a child can still be drawn when this renderable is out of
    // view.
    add(node) {
      super.add(node);
      if (node.vertexBuffer) {
        this.vertexBuffers.push(node.vertexBuffer);
        if (node.boundingVolume) {
          this.boundingVolume = node.boundingVolume.enclosing(this.boundingVolume);
        }
      }
      return this;
    }

    // Removing a child with a buffer takes its buffer out, and puts the
    // renderable's bounding volume together again from the ones left.
    remove(node) {
      super.remove(node);
      if (node.vertexBuffer) {
        this.vertexBuffers = this.vertexBuffers.filter((vb) => vb !== node.vertexBuffer);
        this.boundingVolume = null;
        for (const child of this.items) {
          if (child.vertexBuffer && child.boundingVolume) {
            this.boundingVolume = child.boundingVolume.enclosing(this.boundingVolume);
          }
        }
      }
      return this;
    }

    // withShaderProgram gives the renderable the shader program it draws
    // with, which it owns from then on, and deletes when it is disposed.
    withShaderProgram(shaderProgram) {
      this.shaderProgram = shaderProgram;
      return this;
    }

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
