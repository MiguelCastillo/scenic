import {Node} from "./node.js";
import {mat4} from "@scenic/math";

export class Projection extends Node {
  constructor({type = null, ...options}) {
    if (type !== "orthographic" && type !== "perspective") {
      // eslint-disable-next-line no-console
      console.warn(`projection of type "${type}" is not known`);
    }

    super({type, ...options});
    this.projectionMatrix = mat4.Matrix4.identity();
  }

  withProjection(matrix) {
    this.projectionMatrix = matrix;
    return this;
  }
}
