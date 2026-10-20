// makeStandInGL makes a stand-in for a WebGL2 context, for measuring the
// engine's drawing in Node: its calls do nothing, other than those that
// need an answer, such as a uniform's location, and it counts them.
//
// It returns {gl, callCount}: the context, and callCount(), how many calls
// it has had, other than reading its constants, such as gl.FLOAT.
//
// It is a plain object with every call the engine makes, rather than a
// Proxy that answers any call, since calls through a Proxy make garbage of
// their own, which would be measured as the engine's. A call it doesn't
// have fails, as "gl.someCall is not a function": add it to calls.
export function makeStandInGL() {
  const counter = {calls: 0};
  const countCall = () => {
    counter.calls++;
  };
  const gl = {
    // The constants the engine reads, as WebGL2 defines them.
    TRIANGLES: 4,
    LINES: 1,
    FLOAT: 5126,
    UNSIGNED_INT: 5125,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    LINK_STATUS: 35714,
    ACTIVE_UNIFORMS: 35718,
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
    // The canvas it draws into, for its size.
    canvas: {width: 800, height: 600},
  };
  // The calls that answer nothing.
  const calls = [
    "activeTexture",
    "attachShader",
    "bindAttribLocation",
    "bindBuffer",
    "bindTexture",
    "bindVertexArray",
    "bufferData",
    "deleteBuffer",
    "deleteProgram",
    "deleteVertexArray",
    "disableVertexAttribArray",
    "drawArrays",
    "drawElements",
    "enableVertexAttribArray",
    "linkProgram",
    "uniform1f",
    "uniform1i",
    "uniform2fv",
    "uniform3fv",
    "uniform4fv",
    "uniformMatrix4fv",
    "useProgram",
    "validateProgram",
    "vertexAttribPointer",
  ];
  for (const call of calls) {
    gl[call] = countCall;
  }
  // The calls whose answers the engine uses.
  const answers = {
    createBuffer: () => ({}),
    createProgram: () => ({}),
    createVertexArray: () => ({}),
    getAttribLocation: () => 0,
    getProgramInfoLog: () => "",
    // A program made for measuring is {activeUniforms}, the names of the
    // uniforms its shaders have, as WebGL lists them.
    getActiveUniform: (program, i) => ({name: program.activeUniforms[i]}),
    getProgramParameter: (program, parameter) =>
      parameter === gl.ACTIVE_UNIFORMS ? program.activeUniforms?.length ?? 0 : true,
    getUniformLocation: () => ({}),
  };
  for (const [call, answer] of Object.entries(answers)) {
    gl[call] = (first, second) => {
      counter.calls++;
      return answer(first, second);
    };
  }
  return {gl, callCount: () => counter.calls};
}
