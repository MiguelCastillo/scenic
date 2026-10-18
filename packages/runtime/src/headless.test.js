import {loadScene} from "./load-scene.js";
import {SceneRunner} from "./scene-runner.js";

// A script, as a data URL, that moves its node 10 units along X a second,
// and keeps it on the ground of the terrain named in its settings.
const script = `data:text/javascript,${encodeURIComponent(`
module.exports = (node) => ({
  update({seconds, sceneManager}) {
    const state = sceneManager.getNodeStateByID(node.id);
    const [x, , z] = state.transform.position;
    const ground = sceneManager.getNodeByID(state.script.settings.ground);
    sceneManager.updateNodeStateByID(node.id, {
      transform: {...state.transform, position: [x + 10 * seconds, ground.heightAt(x, z), z]},
    });
  },
});
`)}`;

const config = {
  items: [
    {
      name: "world",
      type: "viewport",
      input: true,
      items: [
        {
          name: "camera",
          type: "camera",
          projection: {type: "perspective", fov: 30, near: 1, far: 1000},
        },
        {name: "ground", type: "terrain", terrain: {seed: 3, height: 500, flatness: 0}},
        {
          name: "rover",
          type: "transform",
          transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
          script: {src: script, settings: {ground: "ground"}},
        },
      ],
    },
  ],
};

describe("a scene without WebGL", () => {
  test("loads and runs its scripts, on its terrain's ground", async () => {
    const scene = await loadScene(null, config, {sceneURL: "http://localhost/race.json"});
    const runner = new SceneRunner(null, scene, {paused: false});
    expect(runner.cameras).toBe(null);

    for (let ms = 0; ms <= 1000; ms += 1000 / 60) {
      runner.stepFrame(ms);
    }

    const {position} = scene.sceneManager.getNodeStateByID("rover").transform;
    expect(position[0]).toBeCloseTo(10, 0);
    const ground = scene.sceneManager.getNodeByID("ground");
    expect(ground.heightAt(5, 0)).not.toBe(0);
    expect(position[1]).toBeCloseTo(ground.heightAt(position[0] - 10 / 60, 0), 3);
    scene.dispose();
  });
});
