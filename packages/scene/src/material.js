import {Node} from "./node.js";

// Material is the material of the mesh it is under: its color, its ambient
// color, how much light it reflects, and its specular highlights, from its
// state. The mesh draws with it, under its own state's material, which wins
// (see setMaterialUniforms in Mesh).
export class Material extends Node {
  constructor(
    options = {},
    materialColor = [0.5, 0.5, 0.5, 1],
    ambientColor = [1, 1, 1],
    reflectionFactor = 1
  ) {
    super({...options, type: "material"});
    this.materialColor = materialColor;
    this.ambientColor = ambientColor;
    this.reflectionFactor = reflectionFactor;
  }

  withAmbientColor(ambientColor) {
    this.ambientColor = ambientColor;
    return this;
  }

  withMaterialColor(materialColor) {
    this.materialColor = materialColor;

    if (materialColor.length === 3) {
      this.materialColor[3] = 1;
    }

    return this;
  }

  withReflectionFactor(reflectionFactor) {
    this.reflectionFactor = reflectionFactor;
    return this;
  }

  preRender(context) {
    super.preRender(context);

    const state = context.sceneManager.getNodeStateByID(this.id);
    if (state) {
      if (state.material?.color) {
        this.withMaterialColor(state.material.color);
      }
      if (state.material?.reflectiveness != null) {
        this.withReflectionFactor(state.material?.reflectiveness);
      }
      if (state.ambient?.color) {
        this.withAmbientColor(state.ambient.color);
      }

      // Specular settings are left to the mesh's defaults unless the state
      // sets them.
      this.specular = state.material?.specular;
      this.shininess = state.material?.shininess;
    }
  }
}
