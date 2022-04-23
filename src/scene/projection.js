import {Node} from "./node.js";
import {Matrix4} from "../math/matrix4.js";

export class Projection extends Node {
  constructor({type=null, ...options}) {
    if (type !== "orthographic" && type !== "perspective") {
      // eslint-disable-next-line no-console
      console.warn(`projection of type "${type}" is not known`);
    }

    super({type, ...options});
    this.projectionMatrix = Matrix4.identity();
  }

  withProjection(matrix) {
    this.projectionMatrix = matrix;
    return this;
  }
}
