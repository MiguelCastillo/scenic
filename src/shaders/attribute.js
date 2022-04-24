// https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer

export class ShaderAttribute {
  constructor(options, shaderProgram) {
    if (!shaderProgram) {
      throw new Error("Must provide the shared program this attribute is for");
    }

    if (!options.name) {
      throw new Error("The attribute must have a name");
    }

    const {gl, program} = shaderProgram;

    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`shader program is not valid or linked. ${gl.getProgramInfoLog(program)}`);
    }

    this.shaderProgram = shaderProgram;

    Object.assign(
      this,
      {
        index: gl.getAttribLocation(program, options.name),
        type: gl.FLOAT,
        size: 3,
        // normamlized tells webgl to clamps values to 0 to 255. For Float type,
        // this doesn't matter.
        normalized: false,
        stride: 0,
        offset: 0,
      },
      options
    );
  }
}
