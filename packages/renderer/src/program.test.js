import {
  ShaderProgram,
  _parseShaderCompilationError,
  parseShaderCompilationErrors,
} from "./program.js";

describe("_parseShaderCompilationError", () => {
  test("single error on the 4 fourth line", () => {
    const shaderSourse = `#version 300 es

in vec3 position;
in vec32 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
}`;

    const expected = _parseShaderCompilationError(
      "ERROR: 0:4: 'color' : syntax error",
      shaderSourse
    );
    expect(expected).toEqual([
      "ERROR",
      "ERROR: 0:4: 'color' : syntax error",
      `#version 300 es

in vec3 position;
>>> in vec32 color;`,
    ]);
  });

  test("single error on the 1st line", () => {
    const shaderSource = `#versio2n 300 es

in vec3 position;
in vec3 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
}`;

    const expected = _parseShaderCompilationError(
      "ERROR: 0:1: 'versio2n' : invalid directive name",
      shaderSource
    );
    expect(expected).toEqual([
      "ERROR",
      "ERROR: 0:1: 'versio2n' : invalid directive name",
      ">>> #versio2n 300 es",
    ]);
  });

  test("error without line number information", () => {
    const shaderSourse = `#version 300 es

in vec3 position;
in vec32 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
}`;

    const expected = _parseShaderCompilationError("ERROR: too many uniforms", shaderSourse);
    expect(expected).toEqual(["ERROR", "ERROR: too many uniforms"]);
  });
});

describe("getAllShaderCompileErrors", () => {
  test("multiple errors on different lines", () => {
    const compileErrors = `ERROR: 0:1: 'versio2n' : invalid directive name
ERROR: 0:3: 'in' : storage qualifier supported in GLSL ES 3.00 and above only
ERROR: 0:4: 'in' : storage qualifier supported in GLSL ES 3.00 and above only
ERROR: 0:4: 'color' : syntax error
`;

    const shaderSource = `#versio2n 300 es

in vec3 position;
in vec3 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
}`;

    const expected = parseShaderCompilationErrors(compileErrors, shaderSource);
    expect(expected[0]).toEqual([
      "ERROR",
      "ERROR: 0:1: 'versio2n' : invalid directive name",
      ">>> #versio2n 300 es",
    ]);

    expect(expected[1]).toEqual([
      "ERROR",
      "ERROR: 0:3: 'in' : storage qualifier supported in GLSL ES 3.00 and above only",
      `#versio2n 300 es

>>> in vec3 position;`,
    ]);

    expect(expected[2]).toEqual([
      "ERROR",
      "ERROR: 0:4: 'in' : storage qualifier supported in GLSL ES 3.00 and above only",
      `#versio2n 300 es

in vec3 position;
>>> in vec3 color;`,
    ]);

    expect(expected[3]).toEqual([
      "ERROR",
      "ERROR: 0:4: 'color' : syntax error",
      `#versio2n 300 es

in vec3 position;
>>> in vec3 color;`,
    ]);
  });
});

describe("ShaderProgram sending to WebGL", () => {
  // A fake WebGL context that keeps the calls programs make: which program
  // is used, and the uniforms sent, by name.
  const fakeGL = () => {
    const calls = [];
    return {
      calls,
      TRIANGLES: 4,
      getUniformLocation: (program, name) => ({name}),
      useProgram: (program) => calls.push(["useProgram", program.name]),
      uniform1f: (location, value) => calls.push(["uniform1f", location.name, value]),
      uniform3fv: (location, value) => calls.push(["uniform3fv", location.name, [...value]]),
      uniformMatrix4fv: (location, transpose, value) =>
        calls.push(["uniformMatrix4fv", location.name, [...value]]),
    };
  };
  const uniform = (name, method, value) => ({
    name,
    update: (gl, {index}) =>
      method === "uniformMatrix4fv" ? gl[method](index, false, value) : gl[method](index, value),
  });

  test("uses a program only when another one is in use", () => {
    const gl = fakeGL();
    const a = new ShaderProgram(gl, {name: "a"});
    const b = new ShaderProgram(gl, {name: "b"});
    a.use();
    a.use();
    b.use();
    a.use();
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["useProgram", "b"],
      ["useProgram", "a"],
    ]);
  });

  test("sends a uniform only when its value changes", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a"});
    program.addUniforms([uniform("color", "uniform3fv", [1, 0.5, 0])]).use();
    program.addUniforms([uniform("color", "uniform3fv", [1, 0.5, 0])]).use();
    program.addUniforms([uniform("color", "uniform3fv", [0, 0, 1])]).use();
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["uniform3fv", "color", [1, 0.5, 0]],
      ["uniform3fv", "color", [0, 0, 1]],
    ]);
  });

  test("keeps values by program, shared by its clones", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a"});
    const clone = program.clone();
    program.addUniforms([uniform("opacity", "uniform1f", 0.5)]).use();
    clone.addUniforms([uniform("opacity", "uniform1f", 1)]).use();
    program.addUniforms([uniform("opacity", "uniform1f", 0.5)]).use();
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["uniform1f", "opacity", 0.5],
      ["uniform1f", "opacity", 1],
      ["uniform1f", "opacity", 0.5],
    ]);
  });

  test("sends only the uniforms set last", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a"});
    program.setUniforms([
      uniform("opacity", "uniform1f", 1),
      uniform("color", "uniform3fv", [1, 1, 1]),
    ]);
    program.use();
    program.setUniforms([uniform("opacity", "uniform1f", 0.5)]);
    program.use();
    expect(gl.calls.slice(3)).toEqual([["uniform1f", "opacity", 0.5]]);
  });

  test("keeps the uniforms a clone adds to itself", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a"});
    program.addUniforms([uniform("opacity", "uniform1f", 1)]);
    const clone = program.clone();
    clone.addUniforms([uniform("opacity", "uniform1f", 0.5)]);
    program.use();
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["uniform1f", "opacity", 1],
    ]);
  });

  test("sends only the uniforms named", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a"}).addUniforms([
      uniform("opacity", "uniform1f", 1),
      uniform("worldMatrix", "uniformMatrix4fv", new Float32Array(16)),
    ]);
    program.use();
    program.addUniforms([uniform("opacity", "uniform1f", 0.5)]);
    program.addUniforms([uniform("worldMatrix", "uniformMatrix4fv", new Float32Array(16).fill(1))]);
    program.sendUniforms(["worldMatrix"]);
    expect(gl.calls.slice(3)).toEqual([["uniformMatrix4fv", "worldMatrix", Array(16).fill(1)]]);
  });
});
