import {Camera, Node, SceneManager, StateManager, Viewport} from "@scenic/scene";

import {CameraSystem} from "./camera-system.js";

const projection = {type: "perspective", fov: 60, near: 1, far: 1000};

// Node IDs must be unique across every test, so each scene gets its own.
let sceneCount = 0;

// createScene builds a world viewport with a rocket and the cameras given as
// {name: {type, ...settings}}, each camera starting at the origin.
// Third-person cameras follow the rocket. id gives a name's node ID in this
// scene.
function createScene(cameras) {
  sceneCount += 1;
  const id = (name) => `${name} ${sceneCount}`;
  const followRocket = (camera) =>
    camera.thirdPerson
      ? {...camera, thirdPerson: {...camera.thirdPerson, target: {nodeID: id("rocket")}}}
      : camera;

  const config = [
    {
      id: id("world"),
      name: "world",
      type: "viewport",
      items: [
        {id: id("rocket"), name: "rocket", type: "transform", transform: {position: [0, 0, 0]}},
        ...Object.entries(cameras).map(([name, camera]) => ({
          ...followRocket(camera),
          id: id(name),
          name,
          projection,
          transform: {position: [0, 0, 0], rotation: [0, 0, 0]},
        })),
      ],
    },
  ];
  const viewport = new Viewport({name: "world", id: id("world")});
  viewport.add(new Node({name: "rocket", id: id("rocket")}));
  for (const [name, {type}] of Object.entries(cameras)) {
    viewport.add(new Camera({name, id: id(name), type}));
  }
  const sceneManager = new SceneManager(new StateManager(config)).withNodes([viewport]);
  return {sceneManager, cameras: new CameraSystem(sceneManager, id("world")), id};
}

const freeFly = {type: "free-fly-camera", freeFly: {speed: 100, maxPitch: 89}};
const chase = {
  type: "third-person-camera",
  thirdPerson: {
    offset: [0, 0, 0],
    distance: 500,
    minDistance: 100,
    maxDistance: 1000,
    rotation: [0, 0],
    maxPitch: 80,
    followTime: 0,
  },
};

const rotationOf = ({sceneManager, id}, name) =>
  sceneManager.getNodeStateByID(id(name)).transform.rotation;
const positionOf = ({sceneManager, id}, name) =>
  sceneManager.getNodeStateByID(id(name)).transform.position;

describe("CameraSystem", () => {
  test("goes through the viewport's cameras", () => {
    const {cameras} = createScene({chase: freeFly, cockpit: freeFly});
    expect(cameras.activeCamera.name).toBe("chase");
    cameras.nextCamera();
    expect(cameras.activeCamera.name).toBe("cockpit");
    cameras.nextCamera();
    expect(cameras.activeCamera.name).toBe("chase");
  });

  test("moves a camera by its type", () => {
    const scene = createScene({chase});
    scene.cameras.moveActiveCamera(0);

    // Behind the rocket, which faces +Z.
    const [x, y, z] = positionOf(scene, "chase");
    expect(x).toBeCloseTo(0, 2);
    expect(y).toBeCloseTo(0, 2);
    expect(z).toBeCloseTo(-500, 2);
  });

  test("leaves a plain camera where it is", () => {
    const scene = createScene({still: {type: "camera"}});
    scene.cameras.turn(10, 0);
    scene.cameras.moveActiveCamera(1);
    expect(rotationOf(scene, "still")).toEqual([0, 0, 0]);
  });

  test("only moves the active camera", () => {
    const scene = createScene({chase: freeFly, cockpit: freeFly});
    scene.cameras.turn(10, 0);
    expect(rotationOf(scene, "chase")[1]).toBe(-10);
    expect(rotationOf(scene, "cockpit")[1]).toBe(0);
  });

  test("keeps a camera's behavior while another camera is active", () => {
    const scene = createScene({chase, cockpit: freeFly});
    const {cameras} = scene;
    cameras.turn(90, 0);
    cameras.moveActiveCamera(0);
    const orbited = positionOf(scene, "chase");

    cameras.nextCamera();
    cameras.nextCamera();
    cameras.moveActiveCamera(0);
    expect(positionOf(scene, "chase")).toEqual(orbited);
  });

  test("keeps held movement with the camera it was set for", () => {
    const scene = createScene({chase: freeFly, cockpit: freeFly});
    const {cameras} = scene;
    cameras.setMovement({forward: 0, right: 0, up: 1});
    cameras.moveActiveCamera(1);
    expect(positionOf(scene, "chase")[1]).toBeCloseTo(100);

    cameras.nextCamera();
    cameras.moveActiveCamera(1);
    expect(positionOf(scene, "cockpit")[1]).toBe(0);
  });

  test("keeps everything in the state, so a new system carries on", () => {
    const scene = createScene({chase});
    scene.cameras.turn(90, 0);
    scene.cameras.moveActiveCamera(0);
    const orbited = positionOf(scene, "chase");

    const cameras = new CameraSystem(scene.sceneManager, scene.id("world"));
    cameras.moveActiveCamera(0);
    expect(positionOf(scene, "chase")).toEqual(orbited);
  });

  describe("applyInput", () => {
    const intents = ({
      look = {x: 0, y: 0},
      zoom = 0,
      move = {forward: 0, right: 0, up: 0},
      nextCamera = false,
    }) => ({look, zoom, move, nextCamera});

    test("switches cameras", () => {
      const {cameras} = createScene({chase: freeFly, cockpit: freeFly});
      cameras.applyInput(intents({nextCamera: true}));
      expect(cameras.activeCamera.name).toBe("cockpit");
      cameras.applyInput(intents({}));
      expect(cameras.activeCamera.name).toBe("cockpit");
    });

    test("flies the way move says, and stops when it says not to", () => {
      const scene = createScene({free: freeFly});
      scene.cameras.applyInput(intents({move: {forward: 0, right: 0, up: 1}}));
      scene.cameras.moveActiveCamera(1);
      expect(positionOf(scene, "free")[1]).toBeCloseTo(100);

      scene.cameras.applyInput(intents({}));
      scene.cameras.moveActiveCamera(1);
      expect(positionOf(scene, "free")[1]).toBeCloseTo(100);
    });

    test("looks, and looks around while paused", () => {
      const leftToTheScene = {...chase, thirdPerson: {...chase.thirdPerson, mouseOrbit: false}};
      const scene = createScene({chase: leftToTheScene});
      scene.cameras.moveActiveCamera(0);
      const behind = positionOf(scene, "chase");

      scene.cameras.applyInput(intents({look: {x: 90, y: 0}}));
      scene.cameras.moveActiveCamera(0);
      expect(positionOf(scene, "chase")).toEqual(behind);

      scene.cameras.applyInput(intents({look: {x: 90, y: 0}}), {paused: true});
      scene.cameras.moveActiveCamera(0);
      expect(positionOf(scene, "chase")).not.toEqual(behind);
    });
  });

  describe("mouseOrbit", () => {
    const leftToTheScene = {...chase, thirdPerson: {...chase.thirdPerson, mouseOrbit: false}};

    test("off leaves the mouse to the scene", () => {
      const scene = createScene({chase: leftToTheScene});
      const {cameras} = scene;
      cameras.moveActiveCamera(0);
      const behind = positionOf(scene, "chase");

      cameras.turn(90, 0);
      cameras.moveActiveCamera(0);
      expect(positionOf(scene, "chase")).toEqual(behind);
    });

    test("is ignored by lookAround, and reset goes back behind", () => {
      const scene = createScene({chase: leftToTheScene});
      const {cameras} = scene;
      cameras.moveActiveCamera(0);
      const behind = positionOf(scene, "chase");

      cameras.lookAround(90, 0);
      cameras.moveActiveCamera(0);
      expect(positionOf(scene, "chase")).not.toEqual(behind);

      cameras.reset();
      cameras.moveActiveCamera(0);
      expect(positionOf(scene, "chase")).toEqual(behind);
    });
  });
});
