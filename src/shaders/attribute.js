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

    Object.assign(this, {
      index: gl.getAttribLocation(program, options.name),
      type: gl.FLOAT,
      size: 3,
      // normamlized tells webgl to clamps values to 0 to 255. For Float type,
      // this doesn't matter.
      normalized: false,
      stride: 0,
      offset: 0,
    }, options);
  }
}
