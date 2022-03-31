import * as mat4 from "../math/matrix4.js";
import {Node} from "./node.js";
import {Projection} from "./projection.js";

export class Renderable extends Node {
  constructor({name, type}) {
    super({name, type});
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram.clone();
    return this;
  }

  withVertexBuffer(vertexBuffer) {
    this.vertexBuffer = vertexBuffer;
    return this;
  }

  getProjectionMatrix() {
    let projectionNode = this;
    while (projectionNode && !(projectionNode instanceof Projection)) {
      projectionNode = projectionNode.parent;
    }

    return projectionNode ?
      projectionNode.projectionMatrix :
      mat4.Matrix4.identity();
  }
}
