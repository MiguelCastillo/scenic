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

    // useProgram activates the renderable's program and returns it, ready to
    // draw the renderable. Activating it makes it the program in use and
    // gives it its uniforms: the renderable's own (see setUniforms), then
    // its viewport's view-projection, camera and fog. A renderable's render
    // starts with it.
    useProgram(context) {
      const program = this.shaderProgram.use();
      this.setUniforms(program, context);
      // Configure the program with the viewport's camera, projection and fog.
      this.getViewport().setUniforms(program, context);
      return program;
    }

    // setUniforms writes the values the renderable has into program, which
    // is in use, such as a mesh's material. A renderable with values of its
    // own overrides it, and one without, such as an fbx skeleton, keeps
    // this one, which sets nothing.
    //
    // It is part of render: it is only called as a renderable's render
    // starts, by useProgram, or by another setUniforms, with render's
    // context; anywhere else its values go missing (see "Where setUniforms
    // is called" in drawing.md, at the top of the repo).
    setUniforms() {}

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
