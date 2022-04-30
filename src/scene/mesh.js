import {Renderable} from "./renderable.js";
import {findParentItemsWithItemTypeName} from "./traversal.js";
import * as vec3 from "../math/vector3.js";

export class Mesh extends Renderable {
  render(context) {
    if (this.vertexBuffers.length && this.shaderProgram) {
      const lightsState = this.getLightsState(context);
      if (lightsState) {
        Mesh.configureLighting(this.shaderProgram, lightsState);
      }

      const materialState = this.getMaterialsState(context);
      if (materialState) {
        Mesh.configureMaterial(this.shaderProgram, materialState.material, materialState.ambient);
      }

      Mesh.render(this);
    }
  }

  // getMaterialsState provides the current state of the material for this
  // mesh.  Override if you need to specify your own settings in some way.
  getMaterialsState(context) {
    const state = context.sceneManager.getNodeStateByID(this.id);
    return {
      material: state.material,
      ambient: state.ambient,
    };
  }

  // getLightsState provides the current state of all the lights that affect
  // this mesh. This is merely calculated based on the first parent that is
  // found that has light objects. Override this if you need a mesh to provide
  // lights state differently.
  getLightsState(context) {
    return findParentItemsWithItemTypeName(this, "light").map(({id}) =>
      context.sceneManager.getNodeStateByID(id)
    );
  }

  static configureLighting(shaderProgram, lights) {
    const uniforms = [];

    for (let i = 0; i < lights.length; i++) {
      let lightState = lights[i];

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

    shaderProgram.addUniforms(uniforms);
  }

  static configureMaterial(shaderProgram, material, ambient) {
    const uniforms = [];

    if (material) {
      if (material.bumpLighting != null) {
        uniforms.push({
          name: "bumpLighting",
          update: (gl, {index}) => {
            gl.uniform1i(index, !!material.bumpLighting);
          },
        });
      }
      if (material.reflectiveness != null) {
        uniforms.push({
          name: "materialReflectiveness",
          update: (gl, {index}) => {
            gl.uniform1f(index, material.reflectiveness == null ? 1 : material.reflectiveness);
          },
        });
      }
      if (material.color != null) {
        uniforms.push({
          name: "materialColor",
          update: (gl, {index}) => {
            gl.uniform4fv(index, material.color || [1, 1, 1, 1]);
          },
        });
      }
    }

    if (ambient) {
      if (ambient.color != null) {
        uniforms.push({
          name: "ambientColor",
          update: (gl, {index}) => {
            const color = ambient.color || [0, 0, 0];
            gl.uniform3fv(index, color);
          },
        });
      }
    }

    if (uniforms.length) {
      shaderProgram.addUniforms(uniforms);
    }
  }

  static render(node) {
    const {shaderProgram, worldMatrix, vertexBuffers} = node;
    const projectionMatrix = node.getProjectionMatrix();

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
    ];

    // Configure shader program with its current state.
    const program = shaderProgram.addUniforms(uniforms);
    vertexBuffers.forEach((vb) => program.render(vb));
  }
}
