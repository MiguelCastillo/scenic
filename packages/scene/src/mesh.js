import {Material} from "./material.js";
import {Renderable} from "./renderable.js";
import {Texture} from "./texture.js";
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

// The names of each light's uniforms, by the light's index in the shader's
// lights, such as `lights[0].position`.
//
// Performance: the names are made once, the first time a light at that
// index is drawn, rather than made as new strings for every light of every
// mesh drawn, every frame (see setLightUniforms).
const lightUniformNamesByIndex = [];

function lightUniformNames(index) {
  while (lightUniformNamesByIndex.length <= index) {
    const i = lightUniformNamesByIndex.length;
    lightUniformNamesByIndex.push({
      position: `lights[${i}].position`,
      color: `lights[${i}].color`,
      intensity: `lights[${i}].intensity`,
      enabled: `lights[${i}].enabled`,
    });
  }
  return lightUniformNamesByIndex[index];
}

// Performance: a light's direction, worked out into the same numbers for
// every light, rather than into a new array for each (see
// setLightUniforms). The uniform keeps its own copy of what it sends.
const lightDirection = new Float32Array(3);

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

  // render draws copiesToRender, each copy of the mesh in view, with its
  // level of detail and the buffers that aren't one. Its viewport calls it,
  // when the mesh is in view (see render in Viewport). It uses its program,
  // set up to draw the mesh (see useProgram in Renderable), then sets each
  // copy's world matrix before drawing the copy.
  //
  // Performance: every copy is drawn with the same program and uniforms but
  // its world matrix, since every WebGL call costs about as much as a draw,
  // and a forest draws hundreds of copies. The uniforms skip values the
  // program already has (see ShaderUniform in @scenic/renderer).
  render(context) {
    const program = this.useProgram(context);

    const worldMatrix = program.uniform("worldMatrix");
    const {vertexBuffers, copiesToRender} = this;
    for (let i = 0; i < copiesToRender.length; i++) {
      const copy = copiesToRender[i];
      worldMatrix.setMatrix4fv(true, copy.worldMatrix.data);
      for (let j = 0; j < vertexBuffers.length; j++) {
        const vb = vertexBuffers[j];
        if (vb.lodDistance == null || vb === copy.lod) {
          program.draw(vb);
        }
      }
    }
  }

  // setUniforms sets the uniforms of program, which must be in use, whose
  // values the mesh has: its lights, its material, and its textures, its
  // Texture children, such as the one a static mesh's state names, which
  // tint its colors (see textures on a static mesh in the README). Each
  // copy's world matrix is set by render, as it draws the copy.
  //
  // It is part of render: it is only called as a renderable's render
  // starts, by useProgram in Renderable, or by another setUniforms, with
  // render's context; anywhere else its values go missing (see "Where
  // setUniforms is called" in drawing.md, at the top of the repo).
  setUniforms(program, context) {
    this.setLightUniforms(program, context);
    this.setMaterialUniforms(program, context);
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] instanceof Texture) {
        this.items[i].setUniforms(program, context);
        program.uniform("textureTint").set1i(true);
      }
    }
  }

  // setLightUniforms sets the uniforms of program for each light that shines
  // on the mesh (see getLightsState), by its index in the shader's lights:
  // its direction, toward its position, its color, its intensity, and that
  // it is on.
  setLightUniforms(program, context) {
    const lights = this.getLightsState(context);
    for (let i = 0; i < lights.length; i++) {
      const names = lightUniformNames(i);
      const lightState = lights[i];

      const position = lightState.transform?.position;
      if (position != null) {
        const length = Math.hypot(position[0], position[1], position[2]) || 1;
        lightDirection[0] = position[0] / length;
        lightDirection[1] = position[1] / length;
        lightDirection[2] = position[2] / length;
        program.uniform(names.position).set3fv(lightDirection);
      }
      const color = lightState.light?.color;
      if (color != null) {
        program.uniform(names.color).set3fv(color);
      }
      const intensity = lightState.light?.intensity;
      if (intensity != null) {
        program.uniform(names.intensity).set1f(intensity);
      }
      program.uniform(names.enabled).set1i(true);
    }
  }

  // setMaterialUniforms sets the uniforms of program for the mesh's
  // material, from three layers, each over the one before:
  // specularDefaults, the mesh's Material node, if it has one, the last of
  // its children that is one, and its state's material and ambient (see
  // getMaterialsState), which win. A value no layer has isn't set, and the
  // program keeps the one it has.
  //
  // Performance: each value is worked out from the layers before it is set,
  // so that it is set once, rather than once for each layer, which would
  // send a value the program doesn't have on every frame for a mesh whose
  // layers differ.
  setMaterialUniforms(program, context) {
    const {material, ambient} = this.getMaterialsState(context);
    let materialNode = null;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] instanceof Material) {
        materialNode = this.items[i];
      }
    }

    const color = material?.color ?? materialNode?.materialColor;
    if (color != null) {
      program.uniform("materialColor").set4fv(color);
    }
    const reflectiveness = material?.reflectiveness ?? materialNode?.reflectionFactor;
    if (reflectiveness != null) {
      program.uniform("materialReflectiveness").set1f(reflectiveness);
    }
    if (material?.bumpLighting != null) {
      program.uniform("bumpLighting").set1i(!!material.bumpLighting);
    }

    // Specular highlights are scaled by reflectiveness like diffuse light,
    // so a material that does not reflect light has none.
    program
      .uniform("materialSpecular")
      .set1f(material?.specular ?? materialNode?.specular ?? specularDefaults.specular);
    program
      .uniform("materialShininess")
      .set1f(material?.shininess ?? materialNode?.shininess ?? specularDefaults.shininess);

    // Opacity is always set, since a program keeps uniform values between
    // meshes, and a translucent mesh drawn before a solid one would
    // otherwise leave it translucent.
    program.uniform("materialOpacity").set1f(material?.opacity ?? 1);

    const ambientColor = ambient?.color ?? materialNode?.ambientColor;
    if (ambientColor != null) {
      program.uniform("ambientColor").set3fv(ambientColor);
    }
    // Ambient light from below is groundColor, which blends with color by
    // which way surfaces face, or the same as color for flat ambient light.
    // It is always set with color, since programs keep uniform values
    // between meshes.
    if (ambient?.color != null) {
      program.uniform("ambientGroundColor").set3fv(ambient.groundColor || ambient.color);
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
