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

// matchValue is the index in sentValues after value, a number or an array
// of them, when sentValues holds it from index, or -1 when it doesn't. An
// undefined value is no value, and a negative index is no match already.
function matchValue(sentValues, index, value) {
  if (index < 0 || value === undefined) {
    return index;
  }
  if (typeof value === "object") {
    for (let j = 0; j < value.length; j++, index++) {
      if (sentValues[index] !== value[j]) {
        return -1;
      }
    }
    return index;
  }
  return sentValues[index] === Number(value) ? index + 1 : -1;
}

// storeValue writes value, a number or an array of them, into sentValues
// from index, and returns the index after it. An undefined value is no
// value.
function storeValue(sentValues, index, value) {
  if (value === undefined) {
    return index;
  }
  if (typeof value === "object") {
    for (let j = 0; j < value.length; j++) {
      sentValues[index++] = value[j];
    }
    return index;
  }
  sentValues[index] = Number(value);
  return index + 1;
}

// The stand-ins for WebGL contexts that uniforms' updates get, by context:
// the context, except that its uniform calls skip values the program in use
// already has.
//
// Performance: a uniform call runs for every uniform of every mesh drawn,
// every frame, so it must not allocate. It takes the arguments after the
// location as four, arg1 to arg4, enough for every WebGL uniform call, such
// as uniform4f(location, x, y, z, w), rather than as a rest parameter
// (...args), which would make an array on every call.
// WebGL ignores the arguments left undefined. See "Best practices for the
// hot path" in the README.
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
              ? (location, arg1, arg2, arg3, arg4) => {
                  const program = programsInUse.get(target);
                  const name = location && uniformNames.get(program)?.get(location);
                  if (name == null) {
                    send(location, arg1, arg2, arg3, arg4);
                    return;
                  }
                  const sentValuesByName = uniformValuesByProgram.get(program);
                  // Performance: arg1 to arg4 are compared and stored one at
                  // a time, by matchValue and storeValue, rather than in a
                  // loop over them, which would need them in an array, made
                  // on every call. sentValues is refilled by index, and its
                  // length set at the end, rather than emptied first (see
                  // "Refilling an array" in the README).
                  let sentValues = sentValuesByName.get(name);
                  if (sentValues) {
                    let index = matchValue(sentValues, 0, arg1);
                    index = matchValue(sentValues, index, arg2);
                    index = matchValue(sentValues, index, arg3);
                    index = matchValue(sentValues, index, arg4);
                    if (index === sentValues.length) {
                      return;
                    }
                  } else {
                    sentValues = [];
                    sentValuesByName.set(name, sentValues);
                  }
                  let index = storeValue(sentValues, 0, arg1);
                  index = storeValue(sentValues, index, arg2);
                  index = storeValue(sentValues, index, arg3);
                  index = storeValue(sentValues, index, arg4);
                  sentValues.length = index;
                  send(location, arg1, arg2, arg3, arg4);
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
    // The program's uniform updates, as {uniform, update}: each uniform,
    // made the first time it is added, with the function that sends its
    // value, the last one added, or null after setUniforms leaves it out.
    // They are kept in a list, to send them all, and by the uniform's name,
    // to change them.
    //
    // Performance: uniforms are added for every mesh drawn, every frame, so
    // each uniform update is made once and its update replaced, and the list
    // is looped by index, without making arrays of names or iterators. See
    // "Best practices for the hot path" in the README.
    this._uniformUpdates = [];
    this._uniformUpdatesByName = new Map();
    // The buffers the last draw drew, and the vertex attributes it enabled
    // for them, the first _enabledAttributeCount of _enabledAttributeIndexes,
    // until the program is released (see draw and release).
    this._boundVertexBuffers = null;
    this._enabledAttributeIndexes = [];
    this._enabledAttributeCount = 0;
  }

  // setUniforms makes uniforms the only ones the program sends, each as
  // {name, update}, with update(gl, uniform) sending its value.
  setUniforms(uniforms) {
    for (let i = 0; i < this._uniformUpdates.length; i++) {
      this._uniformUpdates[i].update = null;
    }
    return this.addUniforms(uniforms);
  }

  // addUniforms adds uniforms to those the program sends, each as
  // {name, update}, replacing the update of one already added by its name.
  addUniforms(uniforms) {
    for (let i = 0; i < uniforms.length; i++) {
      const {name, update} = uniforms[i];
      let uniformUpdate = this._uniformUpdatesByName.get(name);
      if (!uniformUpdate) {
        // NOTE: uniforms stay forever, to avoid making them again every
        // frame. If this becomes a memory issue, then we can perhaps
        // implement LRU.
        uniformUpdate = {uniform: this._createUniform(uniforms[i]), update};
        this._uniformUpdates.push(uniformUpdate);
        this._uniformUpdatesByName.set(name, uniformUpdate);
      }
      uniformUpdate.update = update;
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
    for (const {uniform, update} of this._uniformUpdates) {
      const uniformUpdate = {uniform, update};
      shaderProgram._uniformUpdates.push(uniformUpdate);
      shaderProgram._uniformUpdatesByName.set(uniform.name, uniformUpdate);
    }
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
    const sender = uniformSender(gl);
    for (let i = 0; i < this._uniformUpdates.length; i++) {
      const {uniform, update} = this._uniformUpdates[i];
      if (update) {
        update(sender, uniform);
      }
    }
    return this;
  }

  // sendUniforms sends the program, which must be in use, the values of the
  // uniforms with names, those it doesn't have yet.
  //
  // Performance: it can run for every copy of a mesh drawn, such as each
  // tree of a forest, so pass names that are made once, such as a constant
  // array, rather than a new array each time.
  sendUniforms(names) {
    const sender = uniformSender(this.gl);
    for (let i = 0; i < names.length; i++) {
      const {uniform, update} = this._uniformUpdatesByName.get(names[i]);
      update(sender, uniform);
    }
    return this;
  }

  // draw draws vertexBuffers with the program, which must be in use. Their
  // vertex attributes stay enabled until the program is released, or draws
  // other buffers, so drawing the same buffers again, such as a forest's
  // trees, doesn't set them up again.
  //
  // Performance: it runs for every buffer drawn, every frame, so it loops by
  // index, and finds each attribute's vertex buffer by a name made once
  // (see vertexBufferName in ShaderAttribute), rather than making a string
  // or iterator per draw.
  draw(vertexBuffers, primitiveType = this.gl.TRIANGLES) {
    const gl = this.gl;
    if (this._boundVertexBuffers !== vertexBuffers) {
      this.release();
      this._boundVertexBuffers = vertexBuffers;
      for (let i = 0; i < this._attributes.length; i++) {
        const attribute = this._attributes[i];
        const vertexBuffer = vertexBuffers[attribute.vertexBufferName];
        if (vertexBuffer) {
          const {index, size, type, normalized, stride, offset} = attribute;

          vertexBuffer.bind(gl);

          // Enable this shader attribute.
          gl.enableVertexAttribArray(index);
          // Performance: written by index, up to _enabledAttributeCount,
          // rather than pushed, since release empties the list by setting
          // the count to 0, not its length (see release).
          this._enabledAttributeIndexes[this._enabledAttributeCount++] = index;

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
  //
  // Performance: it runs for every mesh drawn, every frame. The enabled
  // attributes are the first _enabledAttributeCount of
  // _enabledAttributeIndexes, not all of it: the list's length is never set
  // to 0 or shortened, only its count set to 0. Setting an array's length
  // to 0 makes the JavaScript engine free the block of memory the array
  // keeps its items in, so the next draw would allocate a new block. Read
  // it up to the count, never its length. See "Refilling an array" in the
  // README.
  release() {
    const enabledAttributeIndexes = this._enabledAttributeIndexes;
    for (let i = 0; i < this._enabledAttributeCount; i++) {
      this.gl.disableVertexAttribArray(enabledAttributeIndexes[i]);
    }
    this._enabledAttributeCount = 0;
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
