export class ShaderUniform {
  constructor(options, shaderProgram) {
    const {
      gl,
      program,
    } = shaderProgram;

    Object.assign(this, {
      index: gl.getUniformLocation(program, options.name),
    }, options);
  }

  enable() {
    if (this.update) {
      this.update(this);
      return;
    }
  }
}
