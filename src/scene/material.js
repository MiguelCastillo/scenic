import {Node, findParentByType} from "./node.js";
import {Renderable} from "./renderable.js";

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
    }
  }

  render() {
    const renderable = findParentByType(this, Renderable);

    if (renderable) {
      renderable.shaderProgram.addUniforms([
        {
          name: "ambientColor",
          update: (gl, {index}) => {
            gl.uniform3fv(index, this.ambientColor);
          },
        },
        {
          name: "materialReflectiveness",
          update: (gl, {index}) => {
            gl.uniform1f(index, this.reflectionFactor);
          },
        },
        {
          name: "materialColor",
          update: (gl, {index}) => {
            gl.uniform4fv(index, this.materialColor);
          },
        },
      ]);
    }
  }
}
