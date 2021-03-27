import {Node} from "./node.js";

export class Renderable extends Node {
  constructor({name, type}, vertexBuffer, shaderProgram) {
    super({name, type});

    Object.assign(this, {
      vertexBuffer,
      shaderProgram,
    });
  }

  _bindShaderProgram(program) {
    const {vertexBuffer} = this;

    if (!vertexBuffer) {
      throw new Error(`no vertex buffer bound to renderable ${this.name}`);
    }

    program.bind();

    program.getAttributes()
      .filter(attr => vertexBuffer[`${attr.name}s`])
      .forEach(attr => {
        vertexBuffer[`${attr.name}s`].bind();
        attr.bind();
      });
  
    program.getUniforms()
      .forEach(uniform => {
        uniform.enable();
      });
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram;
    return this;
  }

  withVertexBuffer(vertexBuffer) {
    this.vertexBuffer = vertexBuffer;
    return this;
  }
}
