import {mat4} from "@scenic/math";

import {Camera} from "./camera.js";
import {Geometry} from "./geometry.js";
import {Mesh} from "./mesh.js";
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

describe("Mesh prepareForView", () => {
  // A mesh in a viewport whose camera is at z 300 looking down -Z, with a
  // 90 degree view, so that 100 away from it, the view is 200 across, with
  // geometries of positions under it.
  const meshWith = (positionsByGeometry, position = [0, 0, 0]) => {
    const camera = new Camera({name: "camera"})
      .withWorldMatrix(mat4.Matrix4.trs([0, 0, 300], [0, 0, 0], [1, 1, 1]))
      .updateProjection({type: "perspective", fov: 90, near: 1, far: 1000}, 100, 100);
    const mesh = new Mesh({type: "static-mesh", name: "gantry"});
    positionsByGeometry.forEach((positions, i) =>
      mesh.add(
        new Geometry(
          {name: `gantry ${i}`},
          {positions: {data: new Float32Array(positions)}, lodDistance: i ? i * 1000 : null}
        )
      )
    );
    mesh.withWorldMatrix(mat4.Matrix4.trs(position, [0, 0, 0], [1, 1, 1]));
    new Viewport({name: "world"}).add(camera).add(mesh);
    mesh.prepareForView();
    return mesh;
  };

  test("draws its geometries where it is in view", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]]);
    expect(mesh.copiesToRender).toHaveLength(1);
    expect(mesh.copiesToRender[0].vertexBuffers).toHaveLength(1);
  });

  test("draws nothing where its bounding volume is out of view", () => {
    expect(meshWith([[-5, -5, -5, 5, 5, 5]], [0, 0, 600]).copiesToRender).toEqual([]);
  });

  test("culls a long, thin mesh by the box it is, not a sphere around it", () => {
    // A bar 400 long and 2 thick, 100 above the view's top edge 100 away from
    // the camera. A sphere around it would reach 200 down into the view.
    const bar = [-200, -1, -1, 200, 1, 1];
    expect(meshWith([bar], [0, 201, 200]).copiesToRender).toEqual([]);
    expect(meshWith([bar], [0, 99, 200]).copiesToRender).toHaveLength(1);
  });

  test("checks nothing against the view with nothing to draw", () => {
    const mesh = meshWith([]);
    mesh.isBoundingVolumeInView = () => {
      throw new Error("checked a mesh with nothing to draw");
    };
    mesh.prepareForView();
    expect(mesh.copiesToRender).toEqual([]);
  });

  test("draws one level of detail of its geometries", () => {
    // Up close, the full mesh, and not the level for 1000 away.
    const mesh = meshWith([
      [-5, -5, -5, 5, 5, 5],
      [-5, -5, -5, 5, 5, 5],
    ]);
    expect(mesh.copiesToRender[0].vertexBuffers.map((vb) => vb.lodDistance)).toEqual([null]);
  });
});

describe("Mesh render at worldMatrices", () => {
  // A mesh in a viewport whose camera is at z 300 looking down -Z, with one
  // buffer around its origin, and a program that keeps what it was asked to
  // do: [use], [send, names], [draw] and [release].
  const callsAt = (positions) => {
    const camera = new Camera({name: "camera"})
      .withWorldMatrix(mat4.Matrix4.trs([0, 0, 300], [0, 0, 0], [1, 1, 1]))
      .updateProjection({type: "perspective", fov: 90, near: 1, far: 1000}, 100, 100);
    const mesh = new Mesh({type: "static-mesh", name: "tree"}).withWorldMatrix(
      mat4.Matrix4.trs([0, 0, 0], [0, 0, 0], [1, 1, 1])
    );
    new Viewport({name: "world"}).add(camera).add(mesh);
    mesh.add(
      new Geometry(
        {name: "tree shape"},
        {positions: {data: new Float32Array([-5, -5, -5, 5, 5, 5])}}
      )
    );
    mesh.worldMatrices =
      positions && positions.map((p) => mat4.Matrix4.trs(p, [0, 0, 0], [1, 1, 1]));
    const calls = [];
    mesh.shaderProgram = {
      addUniforms: () => mesh.shaderProgram,
      use: () => calls.push(["use"]),
      sendUniforms: (names) => calls.push(["send", names]),
      draw: () => calls.push(["draw"]),
      release: () => calls.push(["release"]),
    };
    mesh.prepareForView();
    Mesh.render(mesh);
    return calls;
  };
  const drawsAt = (positions) => callsAt(positions).filter(([call]) => call === "draw").length;

  test("draws once where the mesh is without worldMatrices", () => {
    expect(drawsAt(null)).toBe(1);
  });

  test("draws once at each of its worldMatrices in view, and not where the mesh is", () => {
    // Two in front of the camera, and one behind it.
    expect(
      drawsAt([
        [0, 0, 0],
        [50, 0, -100],
        [0, 0, 600],
      ])
    ).toBe(2);
  });

  test("draws nothing with no worldMatrices", () => {
    expect(drawsAt([])).toBe(0);
  });

  test("sets the program up once, and sends only the world matrix after", () => {
    expect(
      callsAt([
        [0, 0, 0],
        [50, 0, -100],
      ])
    ).toEqual([["use"], ["draw"], ["send", ["worldMatrix"]], ["draw"], ["release"]]);
  });

  test("leaves the program alone when nothing is in view", () => {
    expect(callsAt([[0, 0, 600]])).toEqual([]);
  });
});
