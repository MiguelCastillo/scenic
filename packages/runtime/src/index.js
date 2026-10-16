// @scenic/runtime runs scenes: loadScene builds a scene from its config and
// loads its models, shaders and scripts, runScene runs it a frame at a time
// with the player's input, and startRenderLoop calls it every frame. Apps
// such as the editor are built on it:
//
//   const scene = await loadScene(gl, config, {sceneURL});
//   const running = runScene(gl, scene);
//   const stop = startRenderLoop(gl, running);
export {loadScene} from "./load-scene.js";
export {runScene} from "./run-scene.js";
export {startRenderLoop} from "./render-loop.js";
