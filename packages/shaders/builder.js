import {ShaderProgram, numberToString} from "./program.js";

const POSITION = "position";

export class ShaderProgramBuilder {
  constructor(gl) {
    this._gl = gl;
    this._pointSize = 1.0;
    this._color = {
      red: 1.0,
      green: 1.0,
      blue: 1.0,
      opacity: 1.0,
    };

    this._shaderProgram = new ShaderProgram(gl);
  }

  pointSize(size) {
    this._pointSize = size;
    return this;
  }

  color(red, green, blue, opacity = 1.0) {
    this._color = {
      red,
      green,
      blue,
      opacity,
    };

    return this;
  }

  build() {
    const {_gl: gl, _pointSize: pointSize, _shaderProgram: shaderProgram} = this;

    const vertShaderCode = `#version 300 es
      in vec3 ${POSITION};
      void main(void) {
        gl_Position = vec4(${POSITION}, 1.0);
        gl_PointSize = ${numberToString(pointSize)};
      }
    `;

    const {red, green, blue, opacity} = this._color;

    const fragShaderCode = `#version 300 es
      precision highp float;
      out vec4 pixelColor;

      void main() {
        pixelColor = vec4(
          ${numberToString(red)},
          ${numberToString(green)},
          ${numberToString(blue)},
          ${numberToString(opacity)}
        );
      }
    `;

    return shaderProgram.link(vertShaderCode, fragShaderCode).setAttributes([
      {
        name: POSITION,
        type: gl.FLOAT,
        size: 3, // The vertex shader code is setup with a 3d vector.
      },
    ]);
  }
}
