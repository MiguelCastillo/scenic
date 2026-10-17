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

  render(context) {
    const {shaderProgram, worldMatrix, vertexBuffers} = this;
    const {sceneManager} = context;

    const projectionMatrix = this.getViewProjectionMatrix();

    // State of the thing we are rendering.
    const renderableState = sceneManager.getNodeStateByID(this.id);

    const sp = shaderProgram.setUniforms([
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
          gl.uniform4fv(index, renderableState.material.color);
        },
      },
      ...this.getViewUniforms(),
    ]);

    vertexBuffers.forEach((vb) => sp.render(vb));
  }
}
