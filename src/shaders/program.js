// Awesome information about vertex and fragment shaders
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

import {ShaderAttribute} from "./attribute.js";
import {ShaderUniform} from "./uniform.js";

export class ShaderProgram {
  constructor(gl, program = gl.createProgram()) {
    this.gl = gl;
    this.program =  program;
    this._attributes = [];
    this._uniforms = [];
  }

  setUniforms(uniforms) {
    this._uniforms = uniforms.map(uniform => new ShaderUniform(uniform, this));
    return this;
  }

  addUniforms(uniforms) {
    const unis = uniforms.map(uni => new ShaderUniform(uni, this));
    this._uniforms = this._uniforms.concat(unis);
    return this;
  }

  getUniforms() {
    return this._uniforms;
  }

  setAttributes(attributes) {
    this._attributes = attributes.map(attr => new ShaderAttribute(attr, this));
    return this;
  }

  addAttributes(attributes) {
    const attrs = attributes.map(attr => new ShaderAttribute(attr, this));
    this._attributes = this._attributes.concat(attrs);
    return this;
  }

  getAttributes() {
    return this._attributes;
  }

  bind() {
    const {gl, program} = this;
    gl.useProgram(program);
    return this;
  }

  link(vertShaderSource, fragShaderSource) {
    const {gl, program} = this;

    linkShaderProgram(
      gl,
      program,
      vertShaderSource,
      fragShaderSource);

    return this;
  }

  clone() {
    const shaderProgram = new ShaderProgram(this.gl, this.program);
    shaderProgram._attributes = [...this._attributes];
    shaderProgram._uniforms = [...this._uniforms];
    return shaderProgram;
  }
}

export function linkShaderProgram(gl, program, vertShaderCode, fragShaderCode) {
  if (!vertShaderCode) {
    throw new Error("Must specify a vertex shader");
  }

  if (!fragShaderCode) {
    throw new Error("Must specify a fragment shader");
  }

  gl.attachShader(program, compileShaderSource(gl, gl.VERTEX_SHADER, vertShaderCode)); 
  gl.attachShader(program, compileShaderSource(gl, gl.FRAGMENT_SHADER, fragShaderCode));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
  }
}

function compileShaderSource(gl, shaderType, shaderSource) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  return shader;
}

// Helper function to convert numbers to strings suitable for shaders.
// Shaders want their values as floats, but the API in ShaderProgramBuilder
// allows to configure values as numbers for simplicity purposes. When a value
// for point size for example, is pecified as the number 5.0, JavaScript will
// drop the decimal part of the number converting to just 5 because the decimal
// point is inconsequetial. If we specified 5.1, then JavaScript will retain
// decimal point because the decimal value is non nonzero. Using 5 without the
// decimal point causes shader compilation errors... This function ensures that
// we always have a decimal point for numbers that JavaScript would otherwise
// drop.
export function numberToString(num) {
  if (typeof num === "number") {
    const numStr = num.toString();
    if (numStr.indexOf(".") === -1) {
      return numStr + ".0";
    }

    return numStr;
  }

  return num;
}
