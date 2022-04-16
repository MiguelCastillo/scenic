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

  // setAttributes sets a new list of attributes in the vertex shader to be
  // bound to buffer objects.
  // In the process of adding the attributes, we will determine the attribute
  // index, which we will use to bind the correct buffer in the render function.
  // This will replace any already existing attributes in the shader program.
  setAttributes(attributes) {
    const attrs = attributes.map(attr => new ShaderAttribute(attr, this));

    attrs.forEach(attr => {
      if (attr.index === -1) {
        // eslint-disable-next-line no-console
        console.warn(`shader attribute ${attr.name} is declared but not used`);
      }
    });

    // Attributes that are not used in the vertex shader do not get an index,
    // so we filter them out to avoid unnecessary processing of attributes
    // in the render function
    this._attributes = attrs.filter(({index}) => index !== -1);
    return this;
  }

  // addAttributes adds new attributes in the vertex shader to be bound to
  // buffer objects.
  // In the process of adding the attributes, we will determine the attribute
  // index, which we will use to bind the correct buffer in the render function.
  addAttributes(attributes) {
    const attrs = attributes.map(attr => new ShaderAttribute(attr, this));

    attrs.forEach(attr => {
      if (attr.index === -1) {
        // eslint-disable-next-line no-console
        console.warn(`shader attribute "${attr.name}" is declared but not used`);
      }
    });

    // Attributes that are not used in the vertex shader do not get an index,
    // so we filter them out to avoid unnecessary processing of attributes
    // in the render function
    this._attributes = this._attributes.concat(attrs.filter(({index}) => index !== -1));
    return this;
  }

  clone() {
    const shaderProgram = new ShaderProgram(this.gl, this.program);
    shaderProgram._attributes = [...this._attributes];
    shaderProgram._uniformsByName = {...this._uniformsByName};
    shaderProgram._uniformsUpdates = {...this._uniformsUpdates};
    return shaderProgram;
  }

  render(vertexBuffers, primitiveType=this.gl.TRIANGLES) {
    const gl = this.gl;
    gl.useProgram(this.program);

    Object.keys(this._uniformsUpdates).forEach(key => {
      this._uniformsUpdates[key](gl, this._uniformsByName[key]);
    });

    for (const attr of this._attributes) {
      // We add `s` because the attribure in the shader is singular and the
      // buffer is plurar.  E.g. the vertex shader has `position` and the
      // buffer has `positions`.
      const ubo = vertexBuffers[`${attr.name}s`];
      if (ubo) {
        const {index, size, type, normalized, stride, offset} = attr;

        ubo.bind(gl);

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

    const {positions, indexes} = vertexBuffers;

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

  // createWithCompiledShaders creates a shader program using the already
  // compiled vertex and fragment shaders provided to this function.
  // There is no ability to autobind attributes in factory method because there
  // is no source we can parse to automatically pull out the attributes in a
  // vertex shader.
  static createWithCompiledShaders(gl, compiledVertexShader, compiledFragmentShader) {
    const program = gl.createProgram();

    // TODO(miguel): add ability to verify that these are compiled shader
    // objects.
    linkShaderProgram(
      gl,
      program,
      compiledVertexShader,
      compiledFragmentShader);

    return new ShaderProgram(gl, program);
  }

  // create creates a shader program with the shader sources provided to this
  // function.
  // Because the source for the vertex shader is provided, we have the ability
  // to parse to autobind attributes. Autobinding simply read the (supported)
  // attributes from the vertex shader and automatically registers them in the
  // shader program before it is returned.
  static create(gl, vertexShaderSource, fragmentShaderSource, autobindAttributes=false) {
    const program = gl.createProgram();

    compileShaderProgram(
      gl,
      program,
      vertexShaderSource,
      fragmentShaderSource,
    );

    const sp = new ShaderProgram(gl, program);
    if (autobindAttributes) {
      sp.addAttributes(parseVertexShaderAttributes(vertexShaderSource));
    }

    return sp;
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
  gl.validateProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
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

// compileShaderSource takes in shader source and its type, and it compiles it.
export function compileShaderSource(gl, shaderType, shaderSource) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  const message = gl.getShaderInfoLog(shader);
  const compileMessages = parseShaderCompilationErrors(
    message,
    shaderSource);

  compileMessages.forEach(([type, message, sourceFailure]) => {
    if (type === "ERROR") {
      // eslint-disable-next-line no-console
      console.error([message, sourceFailure].join("\n"));
    } else {
      // eslint-disable-next-line no-console
      console.warn(message);
    }
  });

  return shader;
}

export function parseShaderCompilationErrors(message, shaderSource, lastLinesCount = 5) {
  // wbgl compile error string seem to always end with `\u0000` (null). We
  // filter those out so that we don't parse invalid error strings.
  return message
    .split("\n")
    .filter(v => v && v !== "\u0000")
    .map(m => _parseShaderCompilationError(m, shaderSource, lastLinesCount));
}

// _parseShaderCompilationError parses error strings from gl.getShaderInfoLog.
// This is not meant to be called directly.  Please use parseShaderCompilationErrors
// instead because that correctly handles null characters.
// This is exported so that it can be tested.
export function _parseShaderCompilationError(message, shaderSource, lastLinesCount = 5) {
  try {
    const shaderLines = shaderSource.split("\n");

    const [,msgType,/*col*/,lineStr] = /^(\w+):\s+(?:([0-9]+):([0-9]+):)?(.*)/.exec(message);
    if (msgType === "ERROR") {
      if (!lineStr) {
        return ["ERROR", message];
      }

      const lineNumberIndex = parseInt(lineStr) - 1;
      const blockStartIndex = Math.max(lineNumberIndex - lastLinesCount, 0);
      const lastFewLines = shaderLines.slice(blockStartIndex, lineNumberIndex);

      lastFewLines.push(">>> " + shaderLines[lineNumberIndex]);
      return ["ERROR", message, lastFewLines.join("\n")];
    } else if (msgType === "WARN") {
      return ["WARN", message];
    }
  } catch(ex) {
    // eslint-disable-next-line no-console
    console.error("error parsing shader compilation error", message, ex);
  }
  return null;
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

// parseVertexShaderAttributes gets the list of all the attributes in a vertex
// shader and returns the name of the attribute and its size. This currently
// only support vector types.
// TODO(miguel): add support for other types as the need arises.
export function parseVertexShaderAttributes(vertexShaderSource) {
  // tester for regex to parse out attributes.
  // https://regex101.com/r/jmad0Z/1
  return [
    ...vertexShaderSource.matchAll(/^\s*^\/?in\s+(\w+)\s+(\w+);/gm)
  ].map(([,type,name]) => {
    let size;
    switch (type) {
      case "vec2":
        size = 2;
        break;
      case "vec3":
        size = 3;
        break;
      case "vec4":
        size = 4;
        break;
    }

    return {
      name,
      size,
    };
  });
}
