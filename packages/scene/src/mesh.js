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
  constructor(options) {
    super(options);
    // World matrices to draw the mesh at instead of where it is, when set by
    // code such as a forest (see render).
    this.instances = null;
  }

  // Specular defaults are set once, when the mesh gets its program, and a
  // program keeps uniform values between frames. A Material node under the
  // mesh can then override them as it renders, and the mesh's own material
  // state overrides both when the mesh renders.
  withShaderProgram(shaderProgram) {
    super.withShaderProgram(shaderProgram);
    this.shaderProgram.addUniforms(Mesh.specularUniforms(specularDefaults));
    return this;
  }

  // render draws the mesh, unless its material's `opacity` is below 1: a
  // translucent mesh is blended over what is behind it, so it is held back
  // in the frame's `translucent` list for SceneManager to draw after
  // everything solid, farthest first (see SceneManager.render). It sets its
  // lights and material up again when it is drawn then, since meshes share
  // shader programs.
  render(context) {
    if (!this.vertexBuffers.length || !this.shaderProgram) {
      return;
    }

    const draw = () => {
      const lightsState = this.getLightsState(context);
      if (lightsState) {
        Mesh.configureLighting(this.shaderProgram, lightsState);
      }

      const materialState = this.getMaterialsState(context);
      if (materialState) {
        Mesh.configureMaterial(this.shaderProgram, materialState.material, materialState.ambient);
      }

      Mesh.render(this);
    };

    const opacity = this.getMaterialsState(context)?.material?.opacity ?? 1;
    if (opacity < 1 && context.translucent) {
      // Matrix4 data is row-major, so positions are the last column of world
      // matrices.
      const camera = this.getViewport()?.activeCamera?.worldMatrix.data;
      const m = this.worldMatrix.data;
      const distance = camera
        ? Math.hypot(m[3] - camera[3], m[7] - camera[7], m[11] - camera[11])
        : 0;
      context.translucent.push({distance, draw});
    } else {
      draw();
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

    // Opacity is always set, since a program keeps uniform values between
    // meshes, and a translucent mesh drawn before a solid one would
    // otherwise leave it translucent.
    uniforms.push({
      name: "materialOpacity",
      update: (gl, {index}) => {
        gl.uniform1f(index, material?.opacity ?? 1);
      },
    });

    if (ambient) {
      if (ambient.color != null) {
        uniforms.push({
          name: "ambientColor",
          update: (gl, {index}) => {
            const color = ambient.color || [0, 0, 0];
            gl.uniform3fv(index, color);
          },
        });

        // Ambient light from below is groundColor, which blends with color
        // by which way surfaces face, or the same as color for flat ambient
        // light. It is always set with color, since programs keep uniform
        // values between meshes.
        uniforms.push({
          name: "ambientGroundColor",
          update: (gl, {index}) => {
            gl.uniform3fv(index, ambient.groundColor || ambient.color);
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

  // isVisible is whether any of vertexBuffer, drawn with worldMatrix, where
  // this mesh is by default, can be in view of its viewport's camera, by the
  // sphere around the buffer's positions. The sphere is worked out the first
  // time it is needed.
  isVisible(vertexBuffer, worldMatrix = this.worldMatrix) {
    const viewport = this.getViewport();
    if (!viewport || !vertexBuffer.positions) {
      return true;
    }
    if (!vertexBuffer.bounds) {
      vertexBuffer.bounds = boundingSphere(vertexBuffer.positions.data);
    }

    // Matrix4 data is row-major: each row is an axis of the world matrix
    // applied to the center, and the longest column is how much it scales.
    const {center, radius} = vertexBuffer.bounds;
    const m = worldMatrix.data;
    const world = [0, 1, 2].map(
      (r) =>
        m[r * 4] * center[0] + m[r * 4 + 1] * center[1] + m[r * 4 + 2] * center[2] + m[r * 4 + 3]
    );
    const scale = Math.max(...[0, 1, 2].map((c) => Math.hypot(m[c], m[4 + c], m[8 + c])));
    return viewport.canSee(world, radius * scale);
  }

  // levelOfDetail is the buffer to draw of a mesh with levels of detail,
  // drawn with worldMatrix, where this mesh is by default: each of its
  // buffers with a lodDistance takes over from that distance from the
  // camera, so it is the one with the farthest lodDistance the mesh is past.
  // It is undefined for a mesh without levels of detail.
  levelOfDetail(worldMatrix = this.worldMatrix) {
    const levels = this.vertexBuffers.filter((vb) => vb.lodDistance != null);
    const camera = this.getViewport()?.activeCamera;
    if (!levels.length || !camera) {
      return levels[0];
    }

    // Matrix4 data is row-major, so positions are the last column of world
    // matrices.
    const [c, m] = [camera.worldMatrix.data, worldMatrix.data];
    const distance = Math.hypot(c[3] - m[3], c[7] - m[7], c[11] - m[11]);
    return levels
      .filter((vb) => vb.lodDistance <= distance)
      .reduce((best, vb) => (!best || vb.lodDistance > best.lodDistance ? vb : best), null);
  }

  // render draws node where it is, or, when it has instances, a list of
  // world matrices, at each of them instead, such as the trees of a forest
  // (see Forest in @scenic/runtime). Each place gets its own level of detail,
  // and places out of view are skipped.
  static render(node) {
    const {shaderProgram, vertexBuffers} = node;
    const projectionMatrix = node.getViewProjectionMatrix();

    // Configure shader program with its current state.
    const program = shaderProgram.addUniforms([
      {
        name: "projectionMatrix",
        update: (gl, {index}) => {
          gl.uniformMatrix4fv(index, false, projectionMatrix.data);
        },
      },
      ...node.getViewUniforms(),
    ]);

    // Buffers out of view are skipped, such as the trees behind a camera,
    // and so are the levels of detail the mesh is too near or too far for.
    for (const worldMatrix of node.instances || [node.worldMatrix]) {
      const lod = node.levelOfDetail(worldMatrix);
      const buffers = vertexBuffers
        .filter((vb) => vb.lodDistance == null || vb === lod)
        .filter((vb) => node.isVisible(vb, worldMatrix));
      if (buffers.length) {
        program.addUniforms([
          {
            name: "worldMatrix",
            update: (gl, {index}) => {
              gl.uniformMatrix4fv(index, true, worldMatrix.data);
            },
          },
        ]);
        buffers.forEach((vb) => program.render(vb));
      }
    }
  }
}

// boundingSphere is a sphere around positions, a flat list of x, y and z: its
// center is the middle of their bounding box, and its radius reaches the
// farthest of them.
export function boundingSphere(positions) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      low[k] = Math.min(low[k], positions[i + k]);
      high[k] = Math.max(high[k], positions[i + k]);
    }
  }
  const center = low.map((v, k) => (v + high[k]) / 2);
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(
      radius,
      Math.hypot(
        positions[i] - center[0],
        positions[i + 1] - center[1],
        positions[i + 2] - center[2]
      )
    );
  }
  return {center, radius};
}
