import {mat4} from "@scenic/math";

import {Camera} from "./camera.js";
import {Mesh, boundingSphere} from "./mesh.js";
import {Node} from "./node.js";
import {Viewport} from "./viewport.js";

describe("Mesh getLightsState", () => {
  // tree builds nodes from [type, name, children] lists, with meshes as
  // Meshes, so that they can be asked for their lights.
  const tree = ([type, name, children = []]) => {
    const NodeType = type === "static-mesh" ? Mesh : Node;
    return new NodeType({type, name}).addItems(children.map(tree));
  };

  // Each node's state is just its name, so the lights a mesh finds can be
  // told apart by name.
  const lightsOf = (root, meshName) => {
    const mesh = Node.findChildrenByType(root, Mesh).find(({name}) => name === meshName);
    const sceneManager = {getNodeStateByID: (id) => sceneManager.names[id]};
    sceneManager.names = Object.fromEntries(
      [root, ...Node.findChildrenByType(root, Node)].map((node) => [node.id, node.name])
    );
    return mesh.getLightsState({sceneManager});
  };

  const world = tree([
    "viewport",
    "world",
    [
      ["light", "fill"],
      ["sky", "sky", [["light", "sun"]]],
      ["static-mesh", "tree"],
      [
        "transform",
        "house",
        [
          ["light", "lamp"],
          ["static-mesh", "chair"],
        ],
      ],
    ],
  ]);

  test("outdoors, includes the sun inside the sky", () => {
    expect(lightsOf(world, "tree")).toEqual(["fill", "sun"]);
  });

  test("indoors, only the lights inside", () => {
    expect(lightsOf(world, "chair")).toEqual(["lamp"]);
  });

  test("a sky's sun lights a scene without other lights", () => {
    const outdoors = tree([
      "viewport",
      "w",
      [
        ["sky", "s", [["light", "sun"]]],
        ["static-mesh", "m"],
      ],
    ]);
    expect(lightsOf(outdoors, "m")).toEqual(["sun"]);
  });

  test("no lights", () => {
    expect(lightsOf(tree(["viewport", "w", [["static-mesh", "m"]]]), "m")).toEqual([]);
  });
});

describe("boundingSphere", () => {
  test("is centered on the middle of the positions and reaches the farthest", () => {
    const {center, radius} = boundingSphere([0, 0, 0, 10, 0, 0, 0, 4, 0]);
    expect(center).toEqual([5, 2, 0]);
    expect(radius).toBeCloseTo(Math.hypot(5, 2), 5);
  });
});

describe("Mesh isVisible", () => {
  // A mesh in a viewport whose camera is at z 300 looking down -Z, with a
  // buffer of positions around the origin, 10 across.
  const meshAt = (position, scale = 1) => {
    const camera = new Camera({name: "camera"})
      .withWorldMatrix(mat4.Matrix4.trs([0, 0, 300], [0, 0, 0], [1, 1, 1]))
      .updateProjection({type: "perspective", fov: 90, near: 1, far: 1000}, 100, 100);
    const mesh = new Mesh({type: "static-mesh", name: "tree"}).withWorldMatrix(
      mat4.Matrix4.trs(position, [0, 0, 0], [scale, scale, scale])
    );
    new Viewport({name: "world"}).add(camera).add(mesh);
    return mesh;
  };
  const buffer = {positions: {data: new Float32Array([-5, -5, -5, 5, 5, 5])}};

  test("is visible in front of the camera", () => {
    expect(meshAt([0, 0, 0]).isVisible({...buffer})).toBe(true);
  });

  test("is not visible behind the camera", () => {
    expect(meshAt([0, 0, 600]).isVisible({...buffer})).toBe(false);
  });

  test("is visible when scaled up enough to reach into view", () => {
    // At 200 to the right of the view's edge, a 10 wide buffer is out of
    // view, until it is scaled up 50 times.
    expect(meshAt([300, 0, 200]).isVisible({...buffer})).toBe(false);
    expect(meshAt([300, 0, 200], 50).isVisible({...buffer})).toBe(true);
  });

  test("is visible without positions to bound", () => {
    expect(meshAt([0, 0, 600]).isVisible({})).toBe(true);
  });
});

describe("Mesh levelOfDetail", () => {
  // A mesh at the origin with buffers that take over at 0, 1000 and 3000
  // from the camera, which is distance away along +Z.
  const lodAt = (distance) => {
    const camera = new Camera({name: "camera"})
      .withWorldMatrix(mat4.Matrix4.trs([0, 0, distance], [0, 0, 0], [1, 1, 1]))
      .updateProjection({type: "perspective", fov: 90, near: 1, far: 10000}, 100, 100);
    const mesh = new Mesh({type: "static-mesh", name: "tree"}).withWorldMatrix(
      mat4.Matrix4.trs([0, 0, 0], [0, 0, 0], [1, 1, 1])
    );
    new Viewport({name: "world"}).add(camera).add(mesh);
    [0, 1000, 3000].forEach((lodDistance) => mesh.addVertexBuffer({lodDistance}));
    return mesh.levelOfDetail().lodDistance;
  };

  test("is the full mesh up close", () => {
    expect(lodAt(500)).toBe(0);
  });

  test("is the level whose distance the mesh is past", () => {
    expect(lodAt(1500)).toBe(1000);
    expect(lodAt(5000)).toBe(3000);
  });

  test("is undefined for a mesh without levels of detail", () => {
    const mesh = new Mesh({type: "static-mesh", name: "rock"}).addVertexBuffer({});
    expect(mesh.levelOfDetail()).toBeUndefined();
  });
});

describe("Mesh render with instances", () => {
  // A mesh in a viewport whose camera is at z 300 looking down -Z, with one
  // buffer around its origin, and a program that counts what it draws.
  const drawsAt = (instances) => {
    const camera = new Camera({name: "camera"})
      .withWorldMatrix(mat4.Matrix4.trs([0, 0, 300], [0, 0, 0], [1, 1, 1]))
      .updateProjection({type: "perspective", fov: 90, near: 1, far: 1000}, 100, 100);
    const mesh = new Mesh({type: "static-mesh", name: "tree"}).withWorldMatrix(
      mat4.Matrix4.trs([0, 0, 0], [0, 0, 0], [1, 1, 1])
    );
    new Viewport({name: "world"}).add(camera).add(mesh);
    mesh.addVertexBuffer({positions: {data: new Float32Array([-5, -5, -5, 5, 5, 5])}});
    mesh.instances = instances && instances.map((p) => mat4.Matrix4.trs(p, [0, 0, 0], [1, 1, 1]));
    let draws = 0;
    mesh.shaderProgram = {addUniforms: () => mesh.shaderProgram, render: () => draws++};
    Mesh.render(mesh);
    return draws;
  };

  test("draws once where the mesh is without instances", () => {
    expect(drawsAt(null)).toBe(1);
  });

  test("draws once at each instance in view, and not where the mesh is", () => {
    // Two in front of the camera, and one behind it.
    expect(
      drawsAt([
        [0, 0, 0],
        [50, 0, -100],
        [0, 0, 600],
      ])
    ).toBe(2);
  });

  test("draws nothing with no instances", () => {
    expect(drawsAt([])).toBe(0);
  });
});
