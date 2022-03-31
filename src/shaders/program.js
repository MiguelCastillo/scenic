// Awesome information about vertex and fragment shaders
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

import {ShaderAttribute} from "./attribute.js";
import {ShaderUniform} from "./uniform.js";

export class ShaderProgram {
  constructor(gl, program) {
    if (!gl || !program) {
      throw new Error("must provide a webgl context and a linked webgl program");
    }

    this.gl = gl;
    this.program =  program;
    this._attributes = [];
    this._uniformsByName = {}; this._uniformsUpdates = {};
  }

  setUniforms(uniforms) {
    this._uniformsUpdates = {};
    for (const uniform of uniforms) {
      this._uniformsUpdates[uniform.name] = uniform.update;
    }

    // NOTE: Cache can stay in memory forever to avoid recreating uniform
    // objects each frame. If this becomes a memory issue, then we can
    // perhaps implement LRU.
    const newUniforms = uniforms
      .filter(uniform => !this._uniformsByName[uniform.name])
      .map(uniform => new ShaderUniform(uniform, this));

    for (const uniform of newUniforms) {
      this._uniformsByName[uniform.name] = uniform;
    }

    return this;
  }

  addUniforms(uniforms) {
    for (const uniform of uniforms) {
      this._uniformsUpdates[uniform.name] = uniform.update;
    }

    const newUniforms = uniforms
      .filter(uniform => !this._uniformsByName[uniform.name])
      .map(uniform => new ShaderUniform(uniform, this));

    if (newUniforms.length) {
      for (const uniform of newUniforms) {
        this._uniformsByName[uniform.name] = uniform;
      }
    }

    return this;
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

  clone() {
    const shaderProgram = new ShaderProgram(this.gl, this.program);
    shaderProgram._attributes = [...this._attributes];
    shaderProgram._uniformsByName = {...this._uniformsByName};
    shaderProgram._uniformsUpdates = {...this._uniformsUpdates};
    return shaderProgram;
  }

  render(vertexBuffer, primitiveType=this.gl.TRIANGLES) {
    const gl = this.gl;
    gl.useProgram(this.program);

    Object.keys(this._uniformsUpdates).forEach(key => {
      this._uniformsUpdates[key](gl, this._uniformsByName[key]);
    });

    for (const attr of this.getAttributes()) {
      if (vertexBuffer[`${attr.name}s`]) {
        vertexBuffer[`${attr.name}s`].bind(gl);

        const {index, size, type, normalized, stride, offset} = attr;

        // Enable this shader attribute.
        gl.enableVertexAttribArray(index);

        // enableVertexAttribArray binds this shader attribute and the currently
        // bound ARRAY_BUFFER we are rendering. So before calling enable on an
        // attribute, you must have called bindBuffer.
        gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
      } else {
        gl.disableVertexAttribArray(attr.index)
      }
    }

    const {positions, indexes} = vertexBuffer;

    // Send command to start rendering the vertices.
    if (indexes) {
      const {data} = indexes;
      const vertexOffset = 0;

      indexes.bind();

      gl.drawElements(
        primitiveType,
        data.length,

        // This MUST match the size of the index buffer.
        gl.UNSIGNED_INT,
        vertexOffset);
    } else if (positions) {
      const {data, componentsPerVertex} = positions;
      const vertexOffset = 0;

      positions.bind();

      gl.drawArrays(
        primitiveType,
        vertexOffset,
        data.length/componentsPerVertex);
    } else {
      throw new Error("neither indexes or positions that are configured. must provide one to render.");
    }
  }

  static create(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();

    linkShaderProgram(
      gl,
      program,
      vertexShader,
      fragmentShader);

    return new ShaderProgram(gl, program);
  }
}

// linkShaderProgram links a WebGL program with already compiled shaders.
// If you have shader source you wish to compile, you can use
// compileShaderSource and pass the results from that to this function.
export function linkShaderProgram(
  gl,             // WebGL context, usually from a canvas.
  program,        // WebGL program, usually from gl.createProgram().
  vertexShader,   // Compiled vertex shader.
  fragmentShader, // Compiled fragment shader.
) {
  if (!vertexShader) {
    throw new Error("must specify a vertex shader to link");
  }

  if (!fragmentShader) {
    throw new Error("must specify a fragment shader to link");
  }

  gl.attachShader(program, vertexShader);   // compileShaderSource(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, fragmentShader); // compileShaderSource(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
  }
}

// compileShaderProgram is like linkShaderProgram except that its inputs are
// vertex shader and fragment shader source code that needs to be compiled
// and then linked.
export function compileShaderProgram(
  gl,                   // WebGL context, usually from a canvas.
  program,              // WebGL program, usually from gl.createProgram().
  vertexShaderSource,   // Vertex shader source. This gets compiled.
  fragmentShaderSource, // Fragment shader source. This gets compiled.
) {
  if (!vertexShaderSource) {
    throw new Error("must specify a vertex shader to compile");
  }

  if (!fragmentShaderSource) {
    throw new Error("must specify a fragment shader to compile");
  }

  linkShaderProgram(
    gl,
    program,
    compileShaderSource(gl, gl.VERTEX_SHADER, vertexShaderSource),
    compileShaderSource(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
}


// TODO(miguel): add caching so that we don't have to compile the source
// if it has already been compiled before.
export function compileShaderSource(gl, shaderType, shaderSource) {
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
