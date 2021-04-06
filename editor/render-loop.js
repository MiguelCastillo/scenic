export function startRenderLoop(gl, updateScene, renderScene) {
  const {canvas} = gl;

  // requestAnimationFrame will _try_ to run at 60 frames per seconds.
  requestAnimationFrame(function renderFrame(ms) {
    // Render all the things...
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // WebGL default frontface is gl.CCW.
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/frontFace
    // gl.frontFace(gl.CW);
    
    // Update the scene and states.
    updateScene(ms);

    // Render the udpated scene with updated states.
    renderScene(ms);

    // Queue up next frame.
    requestAnimationFrame(renderFrame)
  });
}
