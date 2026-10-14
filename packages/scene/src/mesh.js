import {vec3} from "@scenic/math";

import {Renderable} from "./renderable.js";

// findLights returns the lights that shine on a node. It walks up from the
// node to the first ancestor (or the node itself) that has lights among its
// children, and returns those. Lights inside a sky child count too, so the
// sun shines on everything outdoors. Since the walk stops at the first
// ancestor with lights, a building with its own lamps keeps the sun out of
// everything inside it.
const findLights = (node) => {
  for (let current = node; current; current = current.parent) {
    const skies = current.childrenByTypeName.sky || [];
    const lights = [
      ...(current.childrenByTypeName.light || []),
      ...skies.flatMap((sky) => sky.childrenByTypeName.light || []),
    ];
    if (lights.length) {
      return lights;
    }
  }

  return [];
};

// specularDefaults are the specular settings of a material that does not set
// its own: a moderate shine.
export const specularDefaults = {specular: 0.5, shininess: 32};

export class Mesh extends Renderable {
  // Specular defaults are set once, when the mesh gets its program, and a
  // program keeps uniform values between frames. A Material node under the
  // mesh can then override them as it renders, and the mesh's own material
  // state overrides both when the mesh renders.
  withShaderProgram(shaderProgram) {
    super.withShaderProgram(shaderProgram);
    this.shaderProgram.addUniforms(Mesh.specularUniforms(specularDefaults));
    return this;
  }

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
  // this mesh: the lights of the first parent that is found that has any,
  // including the lights inside its sky (see findLights). Override this if
  // you need a mesh to provide lights state differently.
  getLightsState(context) {
    return findLights(this).map(({id}) => context.sceneManager.getNodeStateByID(id));
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

    if (material) {
      uniforms.push(...Mesh.specularUniforms(material));
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

  // specularUniforms configures specular highlights from a material's
  // `specular` and `shininess`, for the ones it sets. Highlights are scaled
  // by reflectiveness like diffuse light, so a material that does not reflect
  // light has none.
  static specularUniforms({specular, shininess}) {
    const uniforms = [];
    if (specular != null) {
      uniforms.push({
        name: "materialSpecular",
        update: (gl, {index}) => {
          gl.uniform1f(index, specular);
        },
      });
    }
    if (shininess != null) {
      uniforms.push({
        name: "materialShininess",
        update: (gl, {index}) => {
          gl.uniform1f(index, shininess);
        },
      });
    }
    return uniforms;
  }

  static render(node) {
    const {shaderProgram, worldMatrix, vertexBuffers} = node;
    const projectionMatrix = node.getViewProjectionMatrix();

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
      ...node.getViewUniforms(),
    ];

    // Configure shader program with its current state.
    const program = shaderProgram.addUniforms(uniforms);
    vertexBuffers.forEach((vb) => program.render(vb));
  }
}
