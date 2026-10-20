import {Renderable} from "./renderable.js";

// SceneNodeLight renders light sources. This scenenode itself does not do
// anything pertaining to lighting at all. Lighting properties from this
// node is rendered in SceneNodeMesh when rendering nodes to which we apply
// lighting to.
export class Light extends Renderable {
  // prepareForView adds the light to its viewport's renderablesInView when
  // it has a marker shape to draw.
  prepareForView() {
    if (this.vertexBuffers.length && this.shaderProgram) {
      this.getViewport()?.renderablesInView.push(this);
    }
  }

  // render draws the light's marker shape, with its program set up to draw
  // it (see useProgram in Renderable).
  render(context) {
    const program = this.useProgram(context);
    const {vertexBuffers} = this;
    for (let i = 0; i < vertexBuffers.length; i++) {
      program.draw(vertexBuffers[i]);
    }
  }

  // setUniforms sets the uniforms of program, which must be in use, whose
  // values the light's marker has: where it is, and its material's color.
  //
  // It is part of render: it is only called as a renderable's render
  // starts, by useProgram in Renderable, or by another setUniforms, with
  // render's context; anywhere else its values go missing (see "Where
  // setUniforms is called" in drawing.md, at the top of the repo).
  setUniforms(program, context) {
    const {material} = context.sceneManager.getNodeStateByID(this.id);
    program.uniform("worldMatrix").setMatrix4fv(true, this.worldMatrix.data);
    program.uniform("materialColor").set4fv(material.color);
  }
}
