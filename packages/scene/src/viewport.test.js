import {mat4} from "@scenic/math";

import {BoundingBox} from "./bounds.js";
import {Camera} from "./camera.js";
import {SceneManager} from "./scene-manager.js";
import {StateManager} from "./state-manager.js";
import {Viewport} from "./viewport.js";

// clipPosition applies a view-projection the way the vertex shaders do. Its
// data is column-major because it is uploaded without transposing.
function clipPosition(viewProjectionMatrix, [x, y, z]) {
  const m = viewProjectionMatrix.data;
  return [0, 1, 2, 3].map((row) => m[row] * x + m[4 + row] * y + m[8 + row] * z + m[12 + row]);
}

function createCamera(name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return new Camera({name})
    .withWorldMatrix(mat4.Matrix4.trs(position, rotation, [1, 1, 1]))
    .updateProjection({type: "perspective", fov: 90, near: 1, far: 1000}, 100, 100);
}

// sceneManagerWithState stands in for a SceneManager when a test only needs
// node state.
function sceneManagerWithState(statesByID) {
  return {getNodeStateByID: (id) => statesByID[id]};
}

describe("Viewport.viewProjectionMatrix", () => {
  test("puts a point the camera looks straight at in the middle of clip space", () => {
    const viewport = new Viewport({name: "world"}).add(createCamera("camera", [0, 0, 300]));
    const [x, y, z, w] = clipPosition(viewport.viewProjectionMatrix, [0, 0, 0]);

    expect(x / w).toBeCloseTo(0, 5);
    expect(y / w).toBeCloseTo(0, 5);
    expect(w).toBeGreaterThan(0);
    expect(Math.abs(z / w)).toBeLessThan(1);
  });

  test("puts a point to the camera's right on the right of clip space", () => {
    const viewport = new Viewport({name: "world"}).add(createCamera("camera", [0, 0, 300]));
    const [x, , , w] = clipPosition(viewport.viewProjectionMatrix, [50, 0, 0]);

    expect(x / w).toBeGreaterThan(0);
  });

  test("follows the camera when it is turned", () => {
    // A yaw of 90 degrees turns the camera from looking down -Z to -X.
    const viewport = new Viewport({name: "world"}).add(
      createCamera("camera", [0, 0, 0], [0, 90, 0])
    );
    const [x, y, , w] = clipPosition(viewport.viewProjectionMatrix, [-300, 0, 0]);

    expect(x / w).toBeCloseTo(0, 5);
    expect(y / w).toBeCloseTo(0, 5);
    expect(w).toBeGreaterThan(0);
  });
});

describe("Viewport.canSeeBoundingVolume", () => {
  // The camera is at z 300 looking down -Z, seeing 90 degrees across, from 1
  // to 1000 away.
  const viewport = () => new Viewport({name: "world"}).add(createCamera("camera", [0, 0, 300]));
  // seesCube is whether view sees a cube reaching half each way from
  // position.
  const seesCube = (view, position, half) =>
    view.canSeeBoundingVolume(
      new BoundingBox([-half, -half, -half], [half, half, half]),
      mat4.Matrix4.trs(position, [0, 0, 0], [1, 1, 1])
    );

  test("sees what is in front of the camera", () => {
    expect(seesCube(viewport(), [0, 0, 0], 1)).toBe(true);
  });

  test("does not see what is behind the camera", () => {
    expect(seesCube(viewport(), [0, 0, 500], 10)).toBe(false);
  });

  test("does not see what is past the far plane", () => {
    // 1050 away, past the far plane at 1000.
    expect(seesCube(viewport(), [0, 0, -750], 10)).toBe(false);
    expect(seesCube(viewport(), [0, 0, -650], 10)).toBe(true);
  });

  test("does not see what is off to the side", () => {
    // 200 to the right at 100 away is past the 45 degrees to each side.
    expect(seesCube(viewport(), [200, 0, 200], 10)).toBe(false);
  });

  test("sees what only reaches into view", () => {
    // The right side of the view is 100 out at 100 away, and this cube's
    // center is 50 past it, but it reaches back in.
    expect(seesCube(viewport(), [150, 0, 200], 60)).toBe(true);
  });

  test("follows the camera when it is turned", () => {
    // Turned to look down -X, it sees what is to its left and not what was
    // in front of it.
    const turned = new Viewport({name: "world"}).add(createCamera("camera", [0, 0, 0], [0, 90, 0]));
    expect(seesCube(turned, [-300, 0, 0], 1)).toBe(true);
    expect(seesCube(turned, [0, 0, -300], 1)).toBe(false);
  });
});

describe("Viewport.render", () => {
  // A viewport whose camera is at the origin, and meshes in view, each a
  // stand-in with a program, an opacity, and a z, which keeps the order it
  // is drawn in.
  const drawOrder = (meshes) => {
    const viewport = new Viewport({name: "world"}).add(createCamera("camera"));
    const drawn = [];
    viewport.meshesToRender = meshes.map(({name, program, opacity = 1, z = 0}) => ({
      shaderProgram: {program},
      worldMatrix: mat4.Matrix4.trs([0, 0, z], [0, 0, 0], [1, 1, 1]),
      getMaterialsState: () => ({material: {opacity}}),
      draw: () => drawn.push(name),
    }));
    const gl = {enable() {}, disable() {}, blendFuncSeparate() {}, depthMask() {}};
    viewport.render({gl});
    return drawn;
  };

  test("draws solid meshes grouped by program, in the order each program is first seen", () => {
    expect(
      drawOrder([
        {name: "tree", program: "leaves"},
        {name: "ship", program: "metal"},
        {name: "bush", program: "leaves"},
      ])
    ).toEqual(["tree", "bush", "ship"]);
  });

  test("draws translucent meshes after solid ones, farthest first", () => {
    expect(
      drawOrder([
        {name: "near glass", program: "glass", opacity: 0.5, z: -10},
        {name: "far glass", program: "glass", opacity: 0.5, z: -100},
        {name: "ship", program: "metal"},
      ])
    ).toEqual(["ship", "far glass", "near glass"]);
  });
});

describe("Viewport.activeCamera", () => {
  test("is the first camera added", () => {
    const front = createCamera("front");
    const viewport = new Viewport({name: "world"}).add(front).add(createCamera("side"));

    expect(viewport.cameras).toHaveLength(2);
    expect(viewport.activeCamera).toBe(front);
  });

  test("is the camera named by activeCamera in the viewport's state", () => {
    const side = createCamera("side");
    const viewport = new Viewport({name: "world", id: "world"})
      .add(createCamera("front"))
      .add(side);

    viewport.updateActiveCamera(sceneManagerWithState({world: {activeCamera: "side"}}));

    expect(viewport.activeCamera).toBe(side);
  });

  test("falls back to the first camera and warns when no camera has that name", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const front = createCamera("front");
    const viewport = new Viewport({name: "world", id: "world"}).add(front);
    const sceneManager = sceneManagerWithState({world: {activeCamera: "missing"}});

    viewport.updateActiveCamera(sceneManager).updateActiveCamera(sceneManager);

    expect(viewport.activeCamera).toBe(front);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("Viewport.remove", () => {
  test("throws when removing the last camera", () => {
    const camera = createCamera("camera");
    const viewport = new Viewport({name: "world"}).add(camera);

    expect(() => viewport.remove(camera)).toThrow(/last camera of viewport "world"/);
    expect(viewport.cameras).toEqual([camera]);
  });

  test("makes the next camera active when the active one is removed", () => {
    const front = createCamera("front");
    const side = createCamera("side");
    const viewport = new Viewport({name: "world"}).add(front).add(side);

    viewport.remove(front);

    expect(viewport.activeCamera).toBe(side);
  });

  test("keeps the active camera when another camera is removed", () => {
    const front = createCamera("front");
    const side = createCamera("side");
    const viewport = new Viewport({name: "world"}).add(front).add(side);

    viewport.remove(side);

    expect(viewport.activeCamera).toBe(front);
  });
});

describe("SceneManager.withNodes", () => {
  function createSceneManager(cameraProjection) {
    const items = [{id: "world", items: [{id: "camera", projection: cameraProjection}]}];
    return new SceneManager(new StateManager(items));
  }

  test("rejects a viewport without a camera", () => {
    const sceneManager = createSceneManager({type: "perspective"});
    const viewport = new Viewport({name: "world", id: "world"});

    expect(() => sceneManager.withNodes([viewport])).toThrow(/viewport "world" has no camera/);
  });

  test("rejects a camera with an unknown projection type", () => {
    const sceneManager = createSceneManager({type: "fisheye"});
    const viewport = new Viewport({name: "world", id: "world"}).add(
      new Camera({name: "camera", id: "camera"})
    );

    expect(() => sceneManager.withNodes([viewport])).toThrow(/projection type "fisheye"/);
  });

  test("accepts viewports that each have a camera", () => {
    const sceneManager = createSceneManager({type: "perspective"});
    const viewport = new Viewport({name: "world", id: "world"}).add(
      new Camera({name: "camera", id: "camera"})
    );

    expect(() => sceneManager.withNodes([viewport])).not.toThrow();
  });
});
