import {Node} from "./node.js";
import {Matrix4} from "../math/matrix4.js";

export class Projection extends Node {
  constructor({name, type}) {
    super({name, type});
    this.worldMatrix = Matrix4.identity();
    this.projectionMatrix = Matrix4.identity();
  }

  withProjection(matrix) {
    this.projectionMatrix = matrix;
    return this;
  }
}
