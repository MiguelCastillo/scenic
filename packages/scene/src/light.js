import {Renderable} from "./renderable.js";

// SceneNodeLight renders light sources. This scenenode itself does not do
// anything pertaining to lighting at all. Lighting properties from this
// node is rendered in SceneNodeMesh when rendering nodes to which we apply
// lighting to.
export class Light extends Renderable {
  render(context) {
    const {shaderProgram, worldMatrix, vertexBuffers} = this;
    const {sceneManager} = context;

    if (!vertexBuffers.length || !shaderProgram) {
      return;
    }

    const projectionMatrix = this.getProjectionMatrix();

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
    ]);

    vertexBuffers.forEach((vb) => sp.render(vb));
  }
}