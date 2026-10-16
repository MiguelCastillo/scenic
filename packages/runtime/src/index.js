// @scenic/runtime runs scenes: loadScene builds a scene from its config and
// loads its models, shaders and scripts, a SceneRunner steps it a frame at a
// time with the player's input, and startRenderLoop calls the runner every
// frame. Apps such as the editor are built on it:
//
//   const scene = await loadScene(gl, config, {sceneURL});
//   const runner = new SceneRunner(gl, scene);
//   const stop = startRenderLoop(gl, runner);
export {loadScene} from "./load-scene.js";
export {SceneRunner} from "./scene-runner.js";
export {startRenderLoop} from "./render-loop.js";
