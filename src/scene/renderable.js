import * as mat4 from "../math/matrix4.js";
import {Node} from "./node.js";
import {Projection} from "./projection.js";

export class Renderable extends Node {
  constructor({name, type}) {
    super({name, type});
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram;
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

  // TODO(miguel): make this a class method instead of a static one.
  // Make sure to use the program and vertexBuffer in the node instance.
  static render(gl, program, vertexBuffer, primitiveType) {
    if (!program) {
      throw new Error("Must provide a shader program");
    }
    if (!vertexBuffer) {
      throw new Error("Must provide a vertex buffer");
    }

    program.bind();

    program
      .getUniforms()
      .forEach(uniform => {
        uniform.enable();
      });

    program
      .getAttributes()
      .forEach(attr => {
        if (vertexBuffer[`${attr.name}s`]) {
          vertexBuffer[`${attr.name}s`].bind();
          attr.bind();
        } else {
          attr.unbind();
        }
      });

    vertexBuffer.render(gl, primitiveType);
  }
}
