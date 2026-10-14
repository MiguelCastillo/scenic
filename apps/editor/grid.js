import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Renderable} from "@scenic/scene";

// Grid draws a flat grid of lines across its local X/Z plane, centered on its
// origin, such as a floor to see things move against. Its transform places it
// like any other node. It draws unlit, with the shader program it is given.
//
// Its settings come from its state:
// - grid.size: how far the grid reaches from one edge to the other, in scene
//   units, along both X and Z.
// - grid.spacing: the distance between lines, in scene units.
// - material.color: the color of the lines, as [r, g, b, a].
//
// The grid builds and owns the vertex buffer for its lines, and draws it as
// lines rather than through the draw list, which holds triangle meshes. The
// buffer is rebuilt when size or spacing change.
export class Grid extends Renderable {
  constructor(options) {
    super({...options, type: "grid"});
    this.lines = null;
    this._linesFor = null;
  }

  preRender(context) {
    super.preRender(context);

    const {size, spacing} = context.sceneManager.getNodeStateByID(this.id).grid;
    if (this._linesFor?.size === size && this._linesFor?.spacing === spacing) {
      return;
    }

    // Lines run from one edge to the other, every spacing units from the
    // center out, so there is always a line through the origin along X and Z.
    const half = size / 2;
    const positions = [];
    for (let offset = 0; offset <= half; offset += spacing) {
      for (const at of offset === 0 ? [0] : [offset, -offset]) {
        positions.push(-half, 0, at, half, 0, at);
        positions.push(at, 0, -half, at, 0, half);
      }
    }

    if (this.lines) {
      this.lines.dispose();
    }
    this.lines = new VertexBuffer({positions: new VertexBufferData(context.gl, positions)});
    this._linesFor = {size, spacing};
  }

  render(context) {
    if (!this.lines || !this.shaderProgram) {
      return;
    }

    const projectionMatrix = this.getViewProjectionMatrix();
    const {worldMatrix} = this;
    const {color} = context.sceneManager.getNodeStateByID(this.id).material;

    this.shaderProgram
      .setUniforms([
        {
          name: "projectionMatrix",
          update: (gl, {index}) => {
            gl.uniformMatrix4fv(index, false, projectionMatrix.data);
          },
        },
        {
          name: "worldMatrix",
          update: (gl, {index}) => {
            gl.uniformMatrix4fv(index, true, worldMatrix.data);
          },
        },
        {
          name: "materialColor",
          update: (gl, {index}) => {
            gl.uniform4fv(index, color);
          },
        },
      ])
      .render(this.lines, context.gl.LINES);
  }

  dispose(gl) {
    if (this.lines) {
      this.lines.dispose();
      this.lines = null;
      this._linesFor = null;
    }

    super.dispose(gl);
  }
}
