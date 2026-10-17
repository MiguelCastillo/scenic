import {Camera, Node, SceneManager, StateManager, Viewport} from "@scenic/scene";

import {SceneRunner} from "./scene-runner.js";

// A fake WebGL context with what updating a scene reads: the canvas's size,
// for cameras' projections.
const gl = {canvas: {width: 100, height: 100}};

describe("SceneRunner", () => {
  test("moves a camera to follow where its target is this frame, before preparing the view", () => {
    const config = [
      {
        id: "world",
        name: "world",
        type: "viewport",
        input: true,
        items: [
          {
            id: "rocket",
            name: "rocket",
            type: "transform",
            transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
          },
          {
            id: "chase",
            name: "chase",
            type: "third-person-camera",
            projection: {type: "perspective", fov: 60, near: 1, far: 1000},
            transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
            thirdPerson: {
              target: {nodeID: "rocket"},
              offset: [0, 0, 0],
              distance: 500,
              minDistance: 100,
              maxDistance: 1000,
              rotation: [0, 0],
              maxPitch: 80,
              followTime: 0,
            },
          },
        ],
      },
    ];

    // The rocket's script flies it up 100 units a second.
    const rocket = new Node({name: "rocket", id: "rocket"}).withScript({
      update({seconds = 0, sceneManager}) {
        const {transform} = sceneManager.getNodeStateByID("rocket");
        const [x, y, z] = transform.position;
        sceneManager.updateNodeStateByID("rocket", {
          transform: {...transform, position: [x, y + 100 * seconds, z]},
        });
      },
    });
    const camera = new Camera({name: "chase", id: "chase", type: "third-person-camera"});
    const viewport = new Viewport({name: "world", id: "world"}).add(rocket).add(camera);
    const sceneManager = new SceneManager(new StateManager(config)).withNodes([viewport]);
    const runner = new SceneRunner(gl, {sceneManager}, {paused: false});

    // What is prepared for the view sees the camera where it moved to, and
    // so does what is attached to the camera.
    const cameraHeightsSeen = [];
    const lamp = new Node({name: "lamp", id: "lamp"});
    viewport.add(
      Object.assign(new Node({name: "forest", id: "forest"}), {
        prepareForView: () => cameraHeightsSeen.push(camera.worldMatrix.data[7]),
      })
    );
    camera.add(lamp);

    runner.stepFrame(0);
    runner.stepFrame(100);

    // The rocket flew up 10, and nothing has drawn it there.
    const rocketY = sceneManager.getNodeStateByID("rocket").transform.position[1];
    const [, cameraY] = sceneManager.getNodeStateByID("chase").transform.position;
    expect(rocketY).toBeCloseTo(10, 5);
    expect(cameraY).toBeCloseTo(10, 5);
    expect(cameraHeightsSeen.at(-1)).toBeCloseTo(10, 5);
    expect(lamp.worldMatrix.data[7]).toBeCloseTo(10, 5);
  });
});
