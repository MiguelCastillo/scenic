import {mat4} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Renderable} from "@scenic/scene";

import {shaderRegistry} from "./shader-registry.js";

// The fill color of a grid that doesn't set one.
const black = [0, 0, 0];

// Grid draws a flat grid of lines across its local X/Z plane, centered on its
// origin, such as a floor to see things move against. It draws unlit.
//
// The lines are not geometry: the grid draws one flat square, and its shader
// works out where the lines are from each pixel's position on it. Lines are
// smoothed to the screen's pixels, so they stay crisp up close, and they fade
// out in the distance where cells get too small to tell apart. A grid can be
// finite, a square of a given size placed by its transform, or infinite: a
// square that follows the camera, as far as it can see, so the grid never
// ends however far anything flies. The lines stay put in the world as the
// square follows the camera. An infinite grid lies flat at its transform's
// height and ignores its rotation and scale.
//
// Its settings come from its state:
// - grid.size: how far the grid reaches from one edge to the other, in scene
//   units, along both X and Z. Leave it out, or 0, for an infinite grid.
// - grid.spacing: the distance between lines, in scene units.
// - grid.lineWidth: how thick lines are, in pixels. Optional, 1 by default.
// - grid.fillColor: the color between the lines, as [r, g, b], which makes
//   the grid a solid floor. Optional; without it only the lines are drawn and
//   whatever is behind shows between them.
// - material.color: the color of the lines, as [r, g, b, a].
export class Grid extends Renderable {
  constructor(options) {
    super({...options, type: "grid"});
    this.square = null;
  }

  // prepareForView adds the grid to its viewport's renderablesInView. The
  // square it is drawn on, from -1 to 1 along X and Z, which render
  // stretches and places, is made the first time it is drawn.
  prepareForView(context) {
    if (!this.square) {
      const corners = [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, 1];
      this.square = new VertexBuffer({positions: new VertexBufferData(context.gl, corners)});
    }
    if (this.shaderProgram) {
      this.getViewport()?.renderablesInView.push(this);
    }
  }

  // render draws the grid's square, with its program set up to draw it (see
  // useProgram in Renderable).
  render(context) {
    const {gl, sceneManager} = context;
    const {fillColor} = sceneManager.getNodeStateByID(this.id).grid;
    const program = this.useProgram(context);

    // The grid is seen from both sides, like a sheet of paper. Without a fill,
    // its shader gives each line pixel how much of it the line covers as its
    // alpha, to blend the line over what is behind it.
    gl.disable(gl.CULL_FACE);
    if (!fillColor) {
      gl.enable(gl.BLEND);
      // Only colors are blended, so the canvas keeps its own alpha.
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    }
    program.draw(this.square);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  // setUniforms sets the uniforms of program, which must be in use, whose
  // values the grid has: where its square is drawn, its lines and its fill.
  //
  // It is part of render: it is only called as a renderable's render
  // starts, by useProgram in Renderable, or by another setUniforms, with
  // render's context; anywhere else its values go missing (see "Where
  // setUniforms is called" in drawing.md, at the top of the repo).
  setUniforms(program, context) {
    const {sceneManager} = context;
    const state = sceneManager.getNodeStateByID(this.id);
    const {size, spacing, lineWidth = 1, fillColor} = state.grid;
    const lineColor = state.material.color;

    // plane takes the square to where it is drawn in the world, and the
    // square's corners are coordScale grid units from its center, which is
    // coordOffset from the grid's origin. Grid units are scene units along
    // the grid, measured from its origin, so that lines go through it.
    let plane;
    let coordScale;
    let coordOffset;
    if (size > 0) {
      const half = size / 2;
      plane = mat4.multiply(mat4.identity(), this.worldMatrix.data, mat4.scale(half, 1, half));
      coordScale = half;
      coordOffset = [0, 0];
    } else {
      // An infinite grid's square is centered under the camera and reaches as
      // far as the camera sees. Matrix4 data is row-major, so positions are
      // the last column of world matrices.
      const camera = this.getViewport().activeCamera;
      const far = sceneManager.getNodeStateByID(camera.id).projection?.far || 10000;
      const c = camera.worldMatrix.data;
      const o = this.worldMatrix.data;
      plane = mat4.multiply(
        mat4.identity(),
        mat4.translate(c[3], o[7], c[11]),
        mat4.scale(far, 1, far)
      );
      coordScale = far;
      coordOffset = [c[3] - o[3], c[11] - o[11]];
    }

    program.uniform("planeMatrix").setMatrix4fv(true, plane);
    program.uniform("coordScale").set1f(coordScale);
    program.uniform("coordOffset").set2fv(coordOffset);
    program.uniform("spacing").set1f(spacing);
    program.uniform("lineWidth").set1f(lineWidth);
    program.uniform("lineColor").set4fv(lineColor);
    program.uniform("filled").set1i(!!fillColor);
    program.uniform("fillColor").set3fv(fillColor || black);
  }

  dispose(gl) {
    if (this.square) {
      this.square.dispose();
      this.square = null;
    }

    super.dispose(gl);
  }
}

shaderRegistry.register(Grid, "shaders/grid");
