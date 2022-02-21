import {Renderable} from "./renderable.js";

// SceneNodeLight renders light sources. This scenenode itself does not do
// anything pertaining to lighting at all. Lighting properties from this
// node is rendered in SceneNodeMesh when rendering nodes to which we apply
// lighting to.
export class Light extends Renderable {
  render(context) {
    const {shaderProgram, worldMatrix, vertexBuffer} = this;
    const {gl, sceneManager} = context;

    if (!vertexBuffer || !shaderProgram) {
      return;
    }

    const projectionMatrix = this.getProjectionMatrix();

    // State of the thing we are rendering.
    const renderableState = sceneManager.getNodeStateByName(this.name);

    const program = shaderProgram
      .clone()
      .setUniforms([{
          name: "projectionMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, false, projectionMatrix.data);
          }
        }, {
          name: "worldMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, true, worldMatrix.data);
          }
        }, {
          name: "materialColor",
          update: ({index}) => {
            gl.uniform4fv(index, renderableState.material.color);
          }
        }
      ]);

    Renderable.render(gl, program, vertexBuffer);
  }
}
