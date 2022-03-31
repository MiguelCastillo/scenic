// https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer

export class ShaderAttribute {
  constructor(options, shaderProgram) {
    if (!shaderProgram) {
      throw new Error("Must provide the shared program this attribute is for");
    }

    if (!options.name) {
      throw new Error("The attribute must have a name");
    }

    // TODO(miguel): validate the incoming options and ensure the program
    // is linked. gl.validateProgram(program)

    const {gl, program} = shaderProgram;
    this.shaderProgram = shaderProgram;

    const index = gl.getAttribLocation(program, options.name);

    if (index === -1) {
      throw new Error(`Shader attribute '${options.name}' was not found`);
    }

    Object.assign(this, {
      index: index,
      type: gl.FLOAT,
      size: 3,
      normalized: false, // For Float type, this doesn't matter.
      stride: 0,
      offset: 0,
    }, options);
  }
}
