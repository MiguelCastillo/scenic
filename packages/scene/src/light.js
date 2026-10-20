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

  // render draws the light's marker shape, with its own uniforms and its
  // viewport's (see setUniforms).
  render(context) {
    const program = this.shaderProgram.use();
    this.setUniforms(program, context);
    this.getViewport().setUniforms(program, context);
    const {vertexBuffers} = this;
    for (let i = 0; i < vertexBuffers.length; i++) {
      program.draw(vertexBuffers[i]);
    }
  }

  // setUniforms sets the uniforms of program, which must be in use, whose
  // values the light's marker has: where it is, and its material's color.
  //
  // It is part of render: only a renderable's render calls it, after use(),
  // itself or through another setUniforms, with render's context; anywhere
  // else its values go missing (see "Where setUniforms is called" in
  // drawing.md, at the top of the repo).
  setUniforms(program, context) {
    const {material} = context.sceneManager.getNodeStateByID(this.id);
    program.uniform("worldMatrix").setMatrix4fv(true, this.worldMatrix.data);
    program.uniform("materialColor").set4fv(material.color);
  }
}
