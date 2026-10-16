import {renderStats} from "@scenic/renderer";

// startRenderLoop runs runner every frame, such as a SceneRunner: it sets up
// and clears the canvas, then calls the runner's updateScene with the frame's
// time and its renderFrame. It returns a function that stops it.
export function startRenderLoop(gl, runner) {
  const {canvas} = gl;

  // requestAnimationFrame will _try_ to run at 60 frames per seconds.
  let frameID = requestAnimationFrame(function tick(ms) {
    // Render all the things...
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Rendering textures that are loaded with new Image() are loaded
    // up side down. So we flip that so that those images look correct.
    // As long as image buffer are stored in the same order as images
    // loaded with new Image(), we can just keep this as default behavior.
    // Otherwise, we are going to need to add a way to flip images more
    // selectively on a per texture basis which can add lots of unwanted
    // complexity because we will need to keep correctly push and pop
    // that configuration from the state stack so that textures don't
    // interfere with each other.
    // https://jameshfisher.com/2020/10/22/why-is-my-webgl-texture-upside-down/
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // WebGL default frontface is gl.CCW.
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/frontFace
    // gl.frontFace(gl.CW);

    // What the last frame drew is kept for anything that shows it, such as
    // a terrain with showTiles, and this frame's drawing is counted afresh.
    renderStats.startFrame();

    // Update the scene and states.
    runner.updateScene(ms);

    // Render the udpated scene with updated states.
    runner.renderFrame();

    // Queue up next frame.
    frameID = requestAnimationFrame(tick);
  });

  return () => cancelAnimationFrame(frameID);
}
