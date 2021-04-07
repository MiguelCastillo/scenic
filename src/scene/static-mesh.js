import {Renderable} from "./renderable.js";
import * as vec3 from "../math/vector3.js";

// SceneNodeMesh renders meshes. These are the node that lighting is applied
// to. These nodes also have material properties which define the default
// color for the mesh as well other properties that affect lighting such as
// reflectiveness.
export class StaticMesh extends Renderable {
  render(context) {
    const {shaderProgram, worldMatrix, vertexBuffer} = this;
    const {gl, projectionMatrix, sceneManager, stateManager} = context;

    if (!vertexBuffer || !shaderProgram) {
      return;
    }

    const lightsStates = sceneManager
      .getLightsForNode(this)
      .map(({name}) => stateManager.getItemByName(name));

    const lightPositions = lightsStates
      .map(({transform: {position}}, idx) => ({
        name: `lightPosition${idx}`,
        update: ({index}) => {
          gl.uniform3fv(index, vec3.normalize(...position));
        }
      }));

    const lightColors = lightsStates
      .map(({light: {color}}, idx) => ({
        name: `lightColor${idx}`,
        update: ({index}) => {
          gl.uniform3fv(index, color);
        }
      }));

    const lightIntensities = lightsStates
      .map(({light: {intensity}}, idx) => ({
        name: `lightIntensity${idx}`,
        update: ({index}) => {
          gl.uniform1f(index, intensity);
        },
      }));

    // State of the thing we are rendering.
    const renderableState = stateManager.getItemByName(this.name);

    // Configure shader program with its current state.
    const program = shaderProgram
      .clone()
      .setUniforms([{
          name: "projectionMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, false, projectionMatrix.data);
          },
        }, {
          name: "worldMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, false, worldMatrix.data);
          },
        }, {
          name: "materialColor",
          update: ({index}) => {
            const {color=[1,1,1,1]} = renderableState.material || {};
            gl.uniform4fv(index, color);
          },
        }, {
          name: "materialReflectiveness",
          update: ({index}) => {
            const {reflectiveness=1} = renderableState.material || {};
            gl.uniform1f(index, reflectiveness);
          },
        }, {
          name: "ambientColor",
          update: ({index}) => {
            const {color=[0,0,0]} = renderableState.ambient || {};

            if (color) {
              gl.uniform3fv(index, color);
            }
          }
        },
        ...lightPositions,
        ...lightColors,
        ...lightIntensities,
      ]);

    this._bindShaderProgram(program);
    vertexBuffer.render(gl, gl.TRIANGLES);
  }
}
