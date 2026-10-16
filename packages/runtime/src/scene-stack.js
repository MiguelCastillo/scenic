import {startRenderLoop} from "./render-loop.js";

// SceneStack runs scenes on top of each other in one render loop, such as a
// game's menu over the game. Every frame it updates each scene, from the
// bottom of the stack up, and then draws them in the same order, each over
// the ones below it. Scenes above the bottom one clear only depth, not
// color, so what is below shows wherever they don't draw, the way a menu
// leaves the game showing around it.
//
// Scenes on it are SceneRunners. Each keeps its own state, and the stack
// doesn't dispose them, since whoever loaded them does.
//
// Its API: runners, bottom first, push(runner), pop(), replace(index,
// runner), which puts runner where the one at index is, and stop(), which
// stops running them.
export class SceneStack {
  constructor(gl) {
    this.runners = [];
    this._stopRenderLoop = startRenderLoop(gl, {
      updateScene: (ms) => this.runners.forEach((runner) => runner.updateScene(ms)),
      renderFrame: () =>
        this.runners.forEach((runner, i) => {
          if (i > 0) {
            gl.clear(gl.DEPTH_BUFFER_BIT);
          }
          runner.renderFrame();
        }),
    });
  }

  push(runner) {
    this.runners.push(runner);
  }

  pop() {
    this.runners.pop();
  }

  replace(index, runner) {
    this.runners[index] = runner;
  }

  stop() {
    this._stopRenderLoop();
  }
}
