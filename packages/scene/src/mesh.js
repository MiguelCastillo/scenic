import {vec3} from "@scenic/math";

import {Renderable} from "./renderable.js";
import {RenderOrder} from "./viewport.js";

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
    // worldMatrices lets one mesh stand in for many copies of itself, such
    // as a forest's trees of one kind. There are hundreds of them, planted
    // around the camera and replaced as it moves, which would be too many
    // to keep as scene nodes of their own.
    //
    // The copies only differ by where they are, so the mesh keeps just
    // their world matrices, set by code such as Forest, and is drawn at
    // each of them instead of at its own worldMatrix. Each copy uses the
    // same buffers, material and program, is checked against the view and
    // given its level of detail on its own, and has a draw call of its own.
    //
    // The copies aren't scene nodes, so they have no state, can't be moved
    // or edited one by one, and don't collide. null draws the mesh once,
    // where it is.
    this.worldMatrices = null;
    // copiesToRender is what to draw this frame, chosen by prepareForView
    // and drawn by render, as [{worldMatrix, lod}]: each copy of the mesh in
    // view, such as a tree, or the mesh itself where it is, with its level
    // of detail, the buffer it draws along with those that aren't one (see
    // levelOfDetail).
    this.copiesToRender = [];
    // Performance: the copies' objects, kept from frame to frame and filled
    // in again, rather than made again every frame for every copy in view.
    this.copies = [];
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

  // render draws copiesToRender, each copy of the mesh in view, with its
  // level of detail and the buffers that aren't one. Its viewport calls it,
  // when the mesh is in view (see render in Viewport).
  //
  // Performance: the program is set up once, with the mesh's lights,
  // material and view, and each copy after the first only sends its world
  // matrix before drawing, since every WebGL call costs about as much as a
  // draw, and a forest draws hundreds of copies.
  render(context) {
    const {shaderProgram} = this;
    const lightsState = this.getLightsState(context);
    if (lightsState) {
      Mesh.configureLighting(shaderProgram, lightsState);
    }

    const materialState = this.getMaterialsState(context);
    if (materialState) {
      Mesh.configureMaterial(shaderProgram, materialState.material, materialState.ambient);
    }

    const projectionMatrix = this.getViewProjectionMatrix();
    shaderProgram.addUniforms([
      {
        name: "projectionMatrix",
        update: (gl, {index}) => {
          gl.uniformMatrix4fv(index, false, projectionMatrix.data);
        },
      },
      ...this.getViewUniforms(),
    ]);

    const {vertexBuffers, copiesToRender} = this;
    for (let i = 0; i < copiesToRender.length; i++) {
      const {worldMatrix, lod} = copiesToRender[i];
      shaderProgram.addUniforms([
        {
          name: "worldMatrix",
          update: (gl, {index}) => {
            gl.uniformMatrix4fv(index, true, worldMatrix.data);
          },
        },
      ]);
      if (i === 0) {
        shaderProgram.use();
      } else {
        shaderProgram.sendUniforms(["worldMatrix"]);
      }
      for (let j = 0; j < vertexBuffers.length; j++) {
        const vb = vertexBuffers[j];
        if (vb.lodDistance == null || vb === lod) {
          shaderProgram.draw(vb);
        }
      }
    }
    shaderProgram.release();
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

  // prepareForView chooses what the mesh draws this frame into
  // copiesToRender, for the view of its viewport's active camera. It runs
  // after the camera has moved for this frame, so it checks against where
  // the camera is now (see prepareForView in SceneManager).
  // 1. The copies it could draw are the mesh itself where it is, or one at
  //    each of its worldMatrices.
  // 2. A copy is skipped when the mesh's bounding volume, placed with the
  //    copy's world matrix, is outside the view.
  // 3. Each copy left draws its level of detail for its distance from the
  //    camera, along with the buffers that aren't a level of detail.
  //
  // Performance: this runs for every mesh, and every copy of one, such as
  // each tree of a forest, every frame. It must not allocate: it loops by
  // index, fills in the copies kept from the last frame, and refills
  // copiesToRender by index. See "Best practices for the hot path" in the
  // README.
  prepareForView(context) {
    const {vertexBuffers, worldMatrices, copiesToRender, copies} = this;

    // With nothing to draw, such as before its model has loaded, there is
    // nothing to check against the view either.
    if (!vertexBuffers.length) {
      copiesToRender.length = 0;
      return;
    }

    // Whether some of its buffers aren't a level of detail, and are drawn
    // at every distance.
    let drawnAtAnyDistance = false;
    for (let i = 0; i < vertexBuffers.length; i++) {
      if (vertexBuffers[i].lodDistance == null) {
        drawnAtAnyDistance = true;
        break;
      }
    }

    const count = worldMatrices ? worldMatrices.length : 1;
    // Performance: copiesToRender is refilled by index, counting the copies
    // in view in copiesInView, and its length is set once, after the loop. It
    // isn't emptied with copiesToRender.length = 0 and refilled with push,
    // the usual way: setting an array's length to 0 makes the JavaScript
    // engine free the block of memory the array keeps its items in, so the
    // next push allocates a new block, for every mesh, every frame. See
    // "Refilling an array" in the README.
    let copiesInView = 0;
    for (let i = 0; i < count; i++) {
      const worldMatrix = worldMatrices ? worldMatrices[i] : this.worldMatrix;
      if (!this.isBoundingVolumeInView(worldMatrix)) {
        continue;
      }

      // A copy can still be left with nothing to draw, when the mesh's
      // levels of detail all start farther away than the copy is.
      const lod = this.levelOfDetail(worldMatrix);
      if (!lod && !drawnAtAnyDistance) {
        continue;
      }

      // Performance: each copy is an object kept in copies from frame to
      // frame and written over, rather than a new {worldMatrix, lod} each
      // frame. copies only grows, the first time this many are in view.
      if (copies.length === copiesInView) {
        copies.push({worldMatrix: null, lod: null});
      }
      const copy = copies[copiesInView];
      copy.worldMatrix = worldMatrix;
      copy.lod = lod;
      copiesToRender[copiesInView++] = copy;
    }
    // Drops last frame's copies past this frame's, when fewer are in view.
    copiesToRender.length = copiesInView;

    // A mesh with copies in view, and a program to draw them with, is drawn
    // by its viewport (see render in Viewport), after everything solid when
    // its material's opacity is below 1.
    if (copiesToRender.length && this.shaderProgram) {
      const opacity = this.getMaterialsState(context)?.material?.opacity ?? 1;
      this.renderOrder = opacity < 1 ? RenderOrder.TRANSLUCENT : RenderOrder.SOLID;
      this.getViewport()?.renderablesInView.push(this);
    }
  }

  // isBoundingVolumeInView is whether the mesh's bounding volume, placed
  // with worldMatrix, can be in view of its viewport's camera (see
  // canSeeBoundingVolume in Viewport). A mesh without one, or without a
  // viewport, can't be ruled out by it.
  isBoundingVolumeInView(worldMatrix) {
    const viewport = this.getViewport();
    return (
      !this.boundingVolume ||
      !viewport ||
      viewport.canSeeBoundingVolume(this.boundingVolume, worldMatrix)
    );
  }

  // levelOfDetail is the buffer to draw of a mesh with levels of detail,
  // drawn with worldMatrix: each of its buffers with a lodDistance takes over
  // from that distance from the camera, so it is the one with the farthest
  // lodDistance the copy is past, or null when it isn't past any. It is
  // undefined for a mesh without levels of detail, and the first level for
  // one without a camera to measure from.
  //
  // Performance: it runs for every copy in view every frame, so it loops by
  // index rather than filtering its buffers (see prepareForView).
  levelOfDetail(worldMatrix) {
    const {vertexBuffers} = this;
    const camera = this.getViewport()?.activeCamera;
    let first;
    let farthest = null;
    let distance = 0;
    for (let i = 0; i < vertexBuffers.length; i++) {
      const vb = vertexBuffers[i];
      if (vb.lodDistance == null) {
        continue;
      }
      if (first === undefined) {
        first = vb;
        if (!camera) {
          return first;
        }
        // Matrix4 data is row-major, so positions are the last column of
        // world matrices.
        const c = camera.worldMatrix.data;
        const m = worldMatrix.data;
        distance = Math.hypot(c[3] - m[3], c[7] - m[7], c[11] - m[11]);
      }
      if (vb.lodDistance <= distance && (!farthest || vb.lodDistance > farthest.lodDistance)) {
        farthest = vb;
      }
    }
    return first === undefined ? undefined : farthest;
  }
}
