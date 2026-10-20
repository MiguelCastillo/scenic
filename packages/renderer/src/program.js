// Awesome information about vertex and fragment shaders
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

import {renderStats} from "./render-stats.js";
import {ShaderUniform} from "./uniform.js";
import {vertexAttributes} from "./vertexbuffer.js";

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

  // dispose deletes the linked WebGL program. Clones share that program, so
  // only its owner should call this. The compiled shaders are left alone
  // because they can be shared by other programs.
  dispose() {
    this.gl.deleteProgram(this.program);
  }

  clone() {
    const shaderProgram = new ShaderProgram(this.gl, this.program);
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

  // render draws vertexBuffer with the program: it uses it, and draws. To
  // draw many times with the same uniforms, such as a forest's trees, use and
  // draw instead, sending only the uniforms that change in between, such as
  // each tree's world matrix.
  render(vertexBuffer, primitiveType = this.gl.TRIANGLES) {
    this.use();
    this.draw(vertexBuffer, primitiveType);
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

  // draw draws vertexBuffer, a VertexBuffer, with the program, which must be
  // in use. Binding its vertex array is all it takes to set up which buffer
  // each vertex attribute reads, since the vertex array recorded that when
  // the geometry was built (see VertexBuffer).
  draw(vertexBuffer, primitiveType = this.gl.TRIANGLES) {
    const gl = this.gl;
    gl.bindVertexArray(vertexBuffer.vertexArray);

    const {positions, indexes} = vertexBuffer;

    // Send command to start rendering the vertices.
    if (indexes) {
      const {data} = indexes;
      const vertexOffset = 0;

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

  // createWithCompiledShaders creates a shader program using the already
  // compiled vertex and fragment shaders provided to this function.
  static createWithCompiledShaders(gl, compiledVertexShader, compiledFragmentShader) {
    const program = gl.createProgram();

    // TODO(miguel): add ability to verify that these are compiled shader
    // objects.
    linkShaderProgram(gl, program, compiledVertexShader, compiledFragmentShader);

    return new ShaderProgram(gl, program);
  }

  // create creates a shader program with the shader sources provided to this
  // function.
  static create(gl, vertexShaderSource, fragmentShaderSource) {
    const program = gl.createProgram();
    compileShaderProgram(gl, program, vertexShaderSource, fragmentShaderSource);
    return new ShaderProgram(gl, program);
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
  // Every program reads each vertex attribute at the same location, so that
  // a geometry's vertex array works with any of them (see vertexAttributes).
  // Binding a name the shader doesn't have does nothing.
  for (const {name, location} of vertexAttributes) {
    gl.bindAttribLocation(program, location, name);
  }
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

// countDraw adds a draw of count vertices to renderStats, and the triangles
// they make when they are triangles.
function countDraw(gl, primitiveType, count) {
  renderStats.drawCalls++;
  if (primitiveType === gl.TRIANGLES) {
    renderStats.triangles += Math.floor(count / 3);
  }
}
