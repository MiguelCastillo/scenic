import {Renderable} from "./renderable.js";
import {findParentItemsWithItemTypeName} from "./traversal.js";
import * as vec3 from "../math/vector3.js";

export class Mesh extends Renderable {
  static render(context, node) {
    const {shaderProgram, worldMatrix, vertexBuffers} = node;

    if (!vertexBuffers.length || !shaderProgram) {
      return;
    }

    const {sceneManager} = context;
    const projectionMatrix = node.getProjectionMatrix();

    // State of the thing we are rendering.
    const renderableState = sceneManager.getNodeStateByID(node.id);

    const lightsStates = findParentItemsWithItemTypeName(node, "light").map(({id}) =>
      sceneManager.getNodeStateByID(id)
    );

    const uniforms = [
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
          const {color = [1, 1, 1, 1]} = (renderableState && renderableState.material) || {};
          gl.uniform4fv(index, color);
        },
      },
      {
        name: "materialReflectiveness",
        update: (gl, {index}) => {
          const {reflectiveness = 1} = (renderableState && renderableState.material) || {};
          gl.uniform1f(index, reflectiveness);
        },
      },
      {
        name: "ambientColor",
        update: (gl, {index}) => {
          const {color = [0, 0, 0]} = (renderableState && renderableState.ambient) || {};
          gl.uniform3fv(index, color);
        },
      },
    ];

    for (let i = 0; i < lightsStates.length; i++) {
      let lightState = lightsStates[i];

      const lightPosition = lightState.transform?.position;
      if (lightPosition != null) {
        uniforms.push({
          name: `lights[${i}].position`,
          update: (gl, {index}) => {
            gl.uniform3fv(
              index,
              vec3.normalize(lightPosition[0], lightPosition[1], lightPosition[2])
            );
          },
        });
      }

      const lightColors = lightState.light?.color;
      if (lightColors != null) {
        uniforms.push({
          name: `lights[${i}].color`,
          update: (gl, {index}) => {
            gl.uniform3fv(index, lightColors);
          },
        });
      }

      const lightIntensities = lightState.light?.intensity;
      if (lightIntensities != null) {
        uniforms.push({
          name: `lights[${i}].intensity`,
          update: (gl, {index}) => {
            gl.uniform1f(index, lightIntensities);
          },
        });
      }

      uniforms.push({
        name: `lights[${i}].enabled`,
        update: (gl, {index}) => {
          gl.uniform1i(index, true);
        },
      });
    }

    // Configure shader program with its current state.
    const program = shaderProgram.addUniforms(uniforms);
    vertexBuffers.forEach((vb) => program.render(vb));
  }
}
