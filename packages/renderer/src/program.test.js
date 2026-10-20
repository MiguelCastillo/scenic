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
  // is used, and the uniforms sent, by name. A program is {name, uniforms},
  // with the names of the uniforms its shaders have.
  const fakeGL = () => {
    const calls = [];
    return {
      calls,
      TRIANGLES: 4,
      ACTIVE_UNIFORMS: 35718,
      getProgramParameter: (program) => program.uniforms.length,
      getActiveUniform: (program, i) => ({name: program.uniforms[i]}),
      getUniformLocation: (program, name) => ({name}),
      useProgram: (program) => calls.push(["useProgram", program.name]),
      uniform1f: (location, value) => calls.push(["uniform1f", location.name, value]),
      uniform1i: (location, value) => calls.push(["uniform1i", location.name, value]),
      uniform3fv: (location, value) => calls.push(["uniform3fv", location.name, [...value]]),
      uniformMatrix4fv: (location, transpose, value) =>
        calls.push(["uniformMatrix4fv", location.name, transpose, [...value]]),
    };
  };

  test("uses a program only when another one is in use", () => {
    const gl = fakeGL();
    const a = new ShaderProgram(gl, {name: "a", uniforms: []});
    const b = new ShaderProgram(gl, {name: "b", uniforms: []});
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

  test("has a uniform for each one its shaders have", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a", uniforms: ["color", "lights[0].color"]});
    expect([...program.uniforms.keys()]).toEqual(["color", "lights[0].color"]);
    expect(program.uniform("lights[0].color").location).toEqual({name: "lights[0].color"});
  });

  test("sends a uniform only when its value changes", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a", uniforms: ["color", "opacity"]}).use();
    program.uniform("color").set3fv([1, 0.5, 0]);
    program.uniform("color").set3fv([1, 0.5, 0]);
    program.uniform("color").set3fv([0, 0, 1]);
    program.uniform("opacity").set1f(1);
    program.uniform("opacity").set1f(1);
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["uniform3fv", "color", [1, 0.5, 0]],
      ["uniform3fv", "color", [0, 0, 1]],
      ["uniform1f", "opacity", 1],
    ]);
  });

  test("sends a boolean as an integer, only when it changes", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a", uniforms: ["fogEnabled"]}).use();
    program.uniform("fogEnabled").set1i(true);
    program.uniform("fogEnabled").set1i(1);
    program.uniform("fogEnabled").set1i(false);
    expect(gl.calls.slice(1)).toEqual([
      ["uniform1i", "fogEnabled", 1],
      ["uniform1i", "fogEnabled", 0],
    ]);
  });

  test("sends a matrix again when how to read it changes", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a", uniforms: ["worldMatrix"]}).use();
    const matrix = new Float32Array(16).fill(1);
    program.uniform("worldMatrix").setMatrix4fv(true, matrix);
    program.uniform("worldMatrix").setMatrix4fv(true, matrix);
    program.uniform("worldMatrix").setMatrix4fv(false, matrix);
    matrix[5] = 2;
    program.uniform("worldMatrix").setMatrix4fv(false, matrix);
    expect(gl.calls.slice(1).map(([call, name, transpose]) => [call, name, transpose])).toEqual([
      ["uniformMatrix4fv", "worldMatrix", true],
      ["uniformMatrix4fv", "worldMatrix", false],
      ["uniformMatrix4fv", "worldMatrix", false],
    ]);
  });

  test("keeps the values sent by program", () => {
    const gl = fakeGL();
    const a = new ShaderProgram(gl, {name: "a", uniforms: ["opacity"]});
    const b = new ShaderProgram(gl, {name: "b", uniforms: ["opacity"]});
    a.use().uniform("opacity").set1f(0.5);
    b.use().uniform("opacity").set1f(0.5);
    a.use().uniform("opacity").set1f(0.5);
    expect(gl.calls).toEqual([
      ["useProgram", "a"],
      ["uniform1f", "opacity", 0.5],
      ["useProgram", "b"],
      ["uniform1f", "opacity", 0.5],
      ["useProgram", "a"],
    ]);
  });

  test("does nothing with a uniform its shaders don't have", () => {
    const gl = fakeGL();
    const program = new ShaderProgram(gl, {name: "a", uniforms: []}).use();
    program.uniform("fogColor").set3fv([1, 1, 1]);
    program.uniform("fogNear").set1f(1);
    expect(gl.calls).toEqual([["useProgram", "a"]]);
  });
});
