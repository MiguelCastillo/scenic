import {_parseShaderCompilationError, parseShaderCompilationErrors} from "./program.js";

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
