// Awesome information about vertex and fragment shaders
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context

import {renderStats} from "./render-stats.js";
import {ShaderUniform, inactiveUniform} from "./uniform.js";
import {vertexAttributes} from "./vertexbuffer.js";

// Performance: the program each WebGL context draws with now, so that a
// program already in use isn't made the one in use again, which costs as
// much as a draw. Keep checking it before every useProgram.
const programsInUse = new WeakMap();

export class ShaderProgram {
  constructor(gl, program) {
    if (!gl || !program) {
      throw new Error("must provide a webgl context and a linked webgl program");
    }

    this.gl = gl;
    this.program = program;
    // The program's uniforms, by name, made once, now that the program is
    // linked: one for each uniform its shaders have, as WebGL lists them,
    // such as `materialColor`, or `lights[0].position` for a field of an
    // array of structs (see uniform).
    this.uniforms = new Map();
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const {name} = gl.getActiveUniform(program, i);
      this.uniforms.set(name, new ShaderUniform(gl, name, gl.getUniformLocation(program, name)));
    }
  }

  // uniform is the program's uniform named name, to set its value once the
  // program is in use, such as uniform("materialColor").set4fv(color), or a
  // uniform whose setters do nothing when its shaders don't have one by
  // that name (see inactiveUniform).
  uniform(name) {
    return this.uniforms.get(name) ?? inactiveUniform;
  }

  // dispose deletes the linked WebGL program. The compiled shaders are left
  // alone because they can be shared by other programs.
  dispose() {
    this.gl.deleteProgram(this.program);
  }

  // use makes the program the one WebGL draws with, unless it already is,
  // so that its uniforms can be set and it can draw.
  use() {
    const gl = this.gl;
    if (programsInUse.get(gl) !== this.program) {
      gl.useProgram(this.program);
      programsInUse.set(gl, this.program);
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
