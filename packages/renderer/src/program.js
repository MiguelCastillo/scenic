// Awesome information about vertex and fragment shaders
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

import {ShaderAttribute} from "./attribute.js";
import {renderStats} from "./render-stats.js";
import {ShaderUniform} from "./uniform.js";

// Performance: the program each WebGL context draws with now, so that a
// program already in use isn't made the one in use again, which costs as
// much as a draw. Keep checking it before every useProgram.
const programsInUse = new WeakMap();

// Performance: each WebGL program's uniforms' names, by their locations, and
// the values they were last sent, by name, so that a value a program already
// has isn't sent again, such as the lights for every mesh drawn with the
// same program. Each WebGL call costs about as much as a draw, so keep
// sending uniforms through uniformSender, which skips them.
// Values are kept by name rather than location because programs cloned from
// one another share a WebGL program but look up locations of their own.
const uniformNames = new WeakMap();
const uniformValuesByProgram = new WeakMap();

// sameValues is whether last, an array, holds the same numbers as values,
// numbers or arrays of them.
function sameValues(last, values) {
  let i = 0;
  for (const value of values) {
    if (typeof value === "object") {
      for (let j = 0; j < value.length; j++, i++) {
        if (last[i] !== value[j]) {
          return false;
        }
      }
    } else if (last[i++] !== Number(value)) {
      return false;
    }
  }
  return i === last.length;
}

// storeValues writes values, numbers or arrays of them, into last, an array,
// reusing it, and returns it.
function storeValues(last, values) {
  let i = 0;
  for (const value of values) {
    if (typeof value === "object") {
      for (let j = 0; j < value.length; j++) {
        last[i++] = value[j];
      }
    } else {
      last[i++] = Number(value);
    }
  }
  last.length = i;
  return last;
}

// The stand-ins for WebGL contexts that uniforms' updates get, by context:
// the context, except that its uniform calls skip values the program in use
// already has.
const uniformSenders = new WeakMap();

function uniformSender(gl) {
  let sender = uniformSenders.get(gl);
  if (!sender) {
    const methods = new Map();
    sender = new Proxy(gl, {
      get(target, property) {
        if (!methods.has(property)) {
          const value = target[property];
          if (typeof value !== "function") {
            return value;
          }
          const send = value.bind(target);
          methods.set(
            property,
            typeof property === "string" && property.startsWith("uniform")
              ? (location, ...values) => {
                  const program = programsInUse.get(target);
                  const name = location && uniformNames.get(program)?.get(location);
                  if (name == null) {
                    send(location, ...values);
                    return;
                  }
                  const valuesByName = uniformValuesByProgram.get(program);
                  const last = valuesByName.get(name);
                  if (last && sameValues(last, values)) {
                    return;
                  }
                  valuesByName.set(name, storeValues(last ?? [], values));
                  send(location, ...values);
                }
              : send
          );
        }
        return methods.get(property);
      },
    });
    uniformSenders.set(gl, sender);
  }
  return sender;
}

export class ShaderProgram {
  constructor(gl, program) {
    if (!gl || !program) {
      throw new Error("must provide a webgl context and a linked webgl program");
    }

    this.gl = gl;
    this.program = program;
    this._attributes = [];
    this._uniformsByName = {};
    this._uniformsUpdates = {};
    // The buffers the last draw drew, and the vertex attributes it enabled
    // for them, until the program is released (see draw and release).
    this._boundVertexBuffers = null;
    this._enabledAttributeIndexes = [];
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
      .filter((uniform) => !this._uniformsByName[uniform.name])
      .map((uniform) => this._createUniform(uniform));

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
      .filter((uniform) => !this._uniformsByName[uniform.name])
      .map((uniform) => this._createUniform(uniform));

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
    const attrs = attributes.map((attr) => new ShaderAttribute(attr, this));

    attrs.forEach((attr) => {
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
    const attrs = attributes.map((attr) => new ShaderAttribute(attr, this));

    attrs.forEach((attr) => {
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

  // dispose deletes the linked WebGL program. Clones share that program, so
  // only its owner should call this. The compiled shaders are left alone
  // because they can be shared by other programs.
  dispose() {
    this.gl.deleteProgram(this.program);
  }

  clone() {
    const shaderProgram = new ShaderProgram(this.gl, this.program);
    shaderProgram._attributes = [...this._attributes];
    shaderProgram._uniformsByName = {...this._uniformsByName};
    shaderProgram._uniformsUpdates = {...this._uniformsUpdates};
    return shaderProgram;
  }

  // _createUniform makes the uniform for options, and keeps its name by its
  // location, for sending only values the program doesn't have yet.
  _createUniform(options) {
    const uniform = new ShaderUniform(options, this);
    if (uniform.index) {
      if (!uniformNames.has(this.program)) {
        uniformNames.set(this.program, new WeakMap());
        uniformValuesByProgram.set(this.program, new Map());
      }
      uniformNames.get(this.program).set(uniform.index, uniform.name);
    }
    return uniform;
  }

  // render draws vertexBuffers with the program: it uses it, draws, and
  // releases it. To draw many times with the same uniforms, such as a forest's
  // trees, use, draw and release instead, sending only the uniforms that
  // change in between, such as each tree's world matrix.
  render(vertexBuffers, primitiveType = this.gl.TRIANGLES) {
    this.use();
    this.draw(vertexBuffers, primitiveType);
    this.release();
  }

  // use makes the program the one WebGL draws with, unless it already is,
  // and sends it its uniforms' values, those it doesn't have yet.
  use() {
    const gl = this.gl;
    if (programsInUse.get(gl) !== this.program) {
      gl.useProgram(this.program);
      programsInUse.set(gl, this.program);
    }
    this.sendUniforms(Object.keys(this._uniformsUpdates));
    return this;
  }

  // sendUniforms sends the program, which must be in use, the values of the
  // uniforms with names, those it doesn't have yet.
  sendUniforms(names) {
    const sender = uniformSender(this.gl);
    for (const name of names) {
      this._uniformsUpdates[name](sender, this._uniformsByName[name]);
    }
    return this;
  }

  // draw draws vertexBuffers with the program, which must be in use. Their
  // vertex attributes stay enabled until the program is released, or draws
  // other buffers, so drawing the same buffers again, such as a forest's
  // trees, doesn't set them up again.
  draw(vertexBuffers, primitiveType = this.gl.TRIANGLES) {
    const gl = this.gl;
    if (this._boundVertexBuffers !== vertexBuffers) {
      this.release();
      this._boundVertexBuffers = vertexBuffers;
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
          this._enabledAttributeIndexes.push(index);

          // enableVertexAttribArray binds this shader attribute and the
          // currently bound ARRAY_BUFFER we are rendering. So before calling
          // enable on an attribute, you must have called bindBuffer.
          gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
        }
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
        vertexOffset
      );
      countDraw(gl, primitiveType, data.length);
    } else if (positions) {
      const {data, componentsPerVertex} = positions;
      const vertexOffset = 0;

      gl.drawArrays(primitiveType, vertexOffset, data.length / componentsPerVertex);
      countDraw(gl, primitiveType, data.length / componentsPerVertex);
    } else {
      throw new Error(
        "neither indexes or positions that are configured. must provide one to render."
      );
    }
    return this;
  }

  // release disables the vertex attributes the program's draws enabled.
  // Enabled attributes are global WebGL state, and an attribute left enabled
  // after its buffer is deleted makes every later draw fail with
  // INVALID_OPERATION, even draws whose shaders never read it.
  release() {
    for (const index of this._enabledAttributeIndexes) {
      this.gl.disableVertexAttribArray(index);
    }
    this._enabledAttributeIndexes = [];
    this._boundVertexBuffers = null;
    return this;
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
    linkShaderProgram(gl, program, compiledVertexShader, compiledFragmentShader);

    return new ShaderProgram(gl, program);
  }

  // create creates a shader program with the shader sources provided to this
  // function.
  // Because the source for the vertex shader is provided, we have the ability
  // to parse to autobind attributes. Autobinding simply read the (supported)
  // attributes from the vertex shader and automatically registers them in the
  // shader program before it is returned.
  static create(gl, vertexShaderSource, fragmentShaderSource, autobindAttributes = false) {
    const program = gl.createProgram();

    compileShaderProgram(gl, program, vertexShaderSource, fragmentShaderSource);

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
  gl, // WebGL context, usually from a canvas.
  program, // WebGL program, usually from gl.createProgram().
  vertexShader, // Compiled vertex shader.
  fragmentShader // Compiled fragment shader.
) {
  if (!vertexShader) {
    throw new Error("must specify a vertex shader to link");
  }

  if (!fragmentShader) {
    throw new Error("must specify a fragment shader to link");
  }

  gl.attachShader(program, vertexShader); // compileShaderSource(gl, gl.VERTEX_SHADER, vertexShaderSource));
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
  gl, // WebGL context, usually from a canvas.
  program, // WebGL program, usually from gl.createProgram().
  vertexShaderSource, // Vertex shader source. This gets compiled.
  fragmentShaderSource // Fragment shader source. This gets compiled.
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
    compileShaderSource(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  );
}

// compileShaderSource takes in shader source and its type, and it compiles it.
export function compileShaderSource(gl, shaderType, shaderSource) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  const message = gl.getShaderInfoLog(shader);
  const compileMessages = parseShaderCompilationErrors(message, shaderSource);

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
    .filter((v) => v && v !== "\u0000")
    .map((m) => _parseShaderCompilationError(m, shaderSource, lastLinesCount));
}

// _parseShaderCompilationError parses error strings from gl.getShaderInfoLog.
// This is not meant to be called directly.  Please use parseShaderCompilationErrors
// instead because that correctly handles null characters.
// This is exported so that it can be tested.
export function _parseShaderCompilationError(message, shaderSource, lastLinesCount = 5) {
  try {
    const shaderLines = shaderSource.split("\n");

    const [, msgType /*col*/, , lineStr] = /^(\w+):\s+(?:([0-9]+):([0-9]+):)?(.*)/.exec(message);
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
  } catch (ex) {
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
  return [...vertexShaderSource.matchAll(/^\s*^\/?in\s+(\w+)\s+(\w+);/gm)].map(([, type, name]) => {
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

// countDraw adds a draw of count vertices to renderStats, and the triangles
// they make when they are triangles.
function countDraw(gl, primitiveType, count) {
  renderStats.drawCalls++;
  if (primitiveType === gl.TRIANGLES) {
    renderStats.triangles += Math.floor(count / 3);
  }
}
