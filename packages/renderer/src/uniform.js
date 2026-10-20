// ShaderUniform is one of a shader program's uniforms, such as
// `materialColor`: its name, its location in the program, and the values the
// program was last sent for it. Its setters send the program a value only
// when the program doesn't have it already, since a program keeps each
// uniform's value until it is sent another, and each WebGL call costs about
// as much as a draw. A program makes its uniforms when it is linked (see
// ShaderProgram).
//
// A setter sends to the program in use, as every WebGL uniform call does, so
// a program must be in use, with its use(), before its uniforms are set.
//
// The values sent are only right while every value the program gets goes
// through its uniforms' setters: a value sent with the WebGL context itself
// would leave them stale, and a later value the program needs could be
// skipped.
//
// Performance: setters run for every uniform of every renderable drawn,
// every frame, so they compare and keep exactly what they send, by index,
// without making anything. See "Best practices for the hot path" in the
// README.
export class ShaderUniform {
  constructor(gl, name, location) {
    this.gl = gl;
    this.name = name;
    this.location = location;
    // The values last sent, by index, as numbers, or empty before any is.
    this.sentValues = [];
  }

  // set1f sets the uniform to value, a number.
  set1f(value) {
    const {sentValues} = this;
    if (sentValues.length === 1 && sentValues[0] === value) {
      return;
    }
    sentValues[0] = value;
    sentValues.length = 1;
    this.gl.uniform1f(this.location, value);
  }

  // set1i sets the uniform to value, an integer or a boolean, such as a
  // texture unit for a sampler, or whether something is on.
  set1i(value) {
    const number = Number(value);
    const {sentValues} = this;
    if (sentValues.length === 1 && sentValues[0] === number) {
      return;
    }
    sentValues[0] = number;
    sentValues.length = 1;
    this.gl.uniform1i(this.location, number);
  }

  // set2fv sets the uniform to values, two numbers.
  set2fv(values) {
    if (this._keepIfChanged(values, 2)) {
      this.gl.uniform2fv(this.location, values);
    }
  }

  // set3fv sets the uniform to values, three numbers, such as a color.
  set3fv(values) {
    if (this._keepIfChanged(values, 3)) {
      this.gl.uniform3fv(this.location, values);
    }
  }

  // set4fv sets the uniform to values, four numbers, such as a color with
  // its opacity.
  set4fv(values) {
    if (this._keepIfChanged(values, 4)) {
      this.gl.uniform4fv(this.location, values);
    }
  }

  // setMatrix4fv sets the uniform to values, the 16 numbers of a matrix,
  // which WebGL reads row by row when transpose is true, and column by
  // column when it is false.
  setMatrix4fv(transpose, values) {
    const {sentValues} = this;
    const transposeNumber = transpose ? 1 : 0;
    if (sentValues[16] === transposeNumber && !this._differs(values, 16)) {
      return;
    }
    this._keep(values, 16);
    sentValues[16] = transposeNumber;
    sentValues.length = 17;
    this.gl.uniformMatrix4fv(this.location, transpose, values);
  }

  // _keepIfChanged keeps the first count of values as the ones sent, when
  // they differ from those last sent, and returns whether they did.
  _keepIfChanged(values, count) {
    if (this.sentValues.length === count && !this._differs(values, count)) {
      return false;
    }
    this._keep(values, count);
    this.sentValues.length = count;
    return true;
  }

  // _differs is whether the first count of values differ from those last
  // sent.
  _differs(values, count) {
    const {sentValues} = this;
    for (let i = 0; i < count; i++) {
      if (sentValues[i] !== values[i]) {
        return true;
      }
    }
    return false;
  }

  // _keep keeps the first count of values as the ones sent.
  _keep(values, count) {
    const {sentValues} = this;
    for (let i = 0; i < count; i++) {
      sentValues[i] = values[i];
    }
  }
}

// inactiveUniform stands in for a uniform a program's shaders don't have,
// such as fog for a shader without it: its setters do nothing, the way
// WebGL does nothing with a uniform that has no location. A renderable can
// then set every uniform it has a value for, whichever shader it draws with
// (see uniform in ShaderProgram).
export const inactiveUniform = Object.freeze({
  name: null,
  set1f() {},
  set1i() {},
  set2fv() {},
  set3fv() {},
  set4fv() {},
  setMatrix4fv() {},
});
