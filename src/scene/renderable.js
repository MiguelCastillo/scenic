import {Node} from "./node.js";

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

  static render(gl, program, vertexBuffer) {
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
        attr.unbind();
      });

    program
      .getAttributes()
      .filter(attr => vertexBuffer[`${attr.name}s`])
      .forEach(attr => {
        vertexBuffer[`${attr.name}s`].bind();
        attr.bind();
      });

    vertexBuffer.render(gl, gl.TRIANGLES);
  }
}
