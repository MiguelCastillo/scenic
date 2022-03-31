import {Renderable} from "./renderable.js";
import {findParentItemsWithItemType} from "./traversal.js";
import * as vec3 from "../math/vector3.js";

// SceneNodeMesh renders meshes. These are the node that lighting is applied
// to. These nodes also have material properties which define the default
// color for the mesh as well other properties that affect lighting such as
// reflectiveness.
export class StaticMesh extends Renderable {
  render(context) {
    const {shaderProgram, worldMatrix, vertexBuffer} = this;

    if (!vertexBuffer || !shaderProgram) {
      return;
    }

    const {sceneManager} = context;
    const projectionMatrix = this.getProjectionMatrix();

    const lightsStates = findParentItemsWithItemType(this, "light")
      .map(({name}) => sceneManager.getNodeStateByName(name));

    const lightPositions = lightsStates
      .map(({transform: {position}}, idx) => ({
        name: `lights[${idx}].position`,
        update: (gl, {index}) => {
          gl.uniform3fv(index, vec3.normalize(...position));
        },
      }));

    const lightColors = lightsStates
      .map(({light: {color}}, idx) => ({
        name: `lights[${idx}].color`,
        update: (gl, {index}) => {
          gl.uniform3fv(index, color);
        }
      }));

    const lightIntensities = lightsStates
      .map(({light: {intensity}}, idx) => ({
        name: `lights[${idx}].intensity`,
        update: (gl, {index}) => {
          gl.uniform1f(index, intensity);
        },
      }));

    const lightEnabled = lightsStates
      .map((_, idx) => ({
        name: `lights[${idx}].enabled`,
        update: (gl, {index}) => {
          gl.uniform1i(index, true);
        },
      }));

    // State of the thing we are rendering.
    const renderableState = sceneManager.getNodeStateByName(this.name);

    // Configure shader program with its current state.
    shaderProgram
      .setUniforms([{
          name: "projectionMatrix",
          update: (gl, {index}) => {
            gl.uniformMatrix4fv(index, false, projectionMatrix.data);
          },
        }, {
          name: "worldMatrix",
          update: (gl, {index}) => {
            gl.uniformMatrix4fv(index, true, worldMatrix.data);
          },
        }, {
          name: "materialColor",
          update: (gl, {index}) => {
            const {color=[1,1,1,1]} = renderableState && renderableState.material || {};
            gl.uniform4fv(index, color);
          },
        }, {
          name: "materialReflectiveness",
          update: (gl, {index}) => {
            const {reflectiveness=1} = renderableState && renderableState.material || {};
            gl.uniform1f(index, reflectiveness);
          },
        }, {
          name: "ambientColor",
          update: (gl, {index}) => {
            const {color=[0,0,0]} = renderableState && renderableState.ambient || {};
            gl.uniform3fv(index, color);
          }
        },
        ...lightPositions,
        ...lightColors,
        ...lightIntensities,
        ...lightEnabled,
      ])
      .render(vertexBuffer);
  }
}
