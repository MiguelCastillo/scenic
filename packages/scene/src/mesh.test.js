import {mat4} from "@scenic/math";

import {Camera} from "./camera.js";
import {Geometry} from "./geometry.js";
import {Mesh} from "./mesh.js";
import {Node} from "./node.js";
import {Texture} from "./texture.js";
import {RenderOrder, Viewport} from "./viewport.js";

// contextWith is the context a mesh gets each frame, with a scene manager
// whose every node has state.
const contextWith = (state = {}) => ({sceneManager: {getNodeStateByID: () => state}});

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
    mesh.vertexBuffers = [0, 1000, 3000].map((lodDistance) => ({lodDistance}));
    return mesh.levelOfDetail(mesh.worldMatrix).lodDistance;
  };

  test("is the full mesh up close", () => {
    expect(lodAt(500)).toBe(0);
  });

  test("is the level whose distance the mesh is past", () => {
    expect(lodAt(1500)).toBe(1000);
    expect(lodAt(5000)).toBe(3000);
  });

  test("is undefined for a mesh without levels of detail", () => {
    const mesh = new Mesh({type: "static-mesh", name: "rock"});
    mesh.vertexBuffers = [{}];
    expect(mesh.levelOfDetail(mesh.worldMatrix)).toBeUndefined();
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
    mesh.prepareForView(contextWith());
    return mesh;
  };

  test("draws its geometries where it is in view", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]]);
    expect(mesh.copiesToRender).toHaveLength(1);
    expect(mesh.copiesToRender[0].worldMatrix).toBe(mesh.worldMatrix);
  });

  // Performance: prepareForView runs for every copy every frame, so it must
  // not make new copies each time (see prepareForView).
  test("fills in the same copies every frame", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]]);
    const [copy] = mesh.copiesToRender;
    mesh.prepareForView(contextWith());
    expect(mesh.copiesToRender).toEqual([copy]);
    expect(mesh.copiesToRender[0]).toBe(copy);
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
    mesh.prepareForView(contextWith());
    expect(mesh.copiesToRender).toEqual([]);
  });

  test("adds itself to its viewport's renderables in view, as solid", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]]);
    mesh.shaderProgram = {};
    mesh.prepareForView(contextWith());
    expect(mesh.getViewport().renderablesInView).toEqual([mesh]);
    expect(mesh.renderOrder).toBe(RenderOrder.SOLID);
  });

  test("is translucent when its material's opacity is below 1", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]]);
    mesh.shaderProgram = {};
    mesh.prepareForView(contextWith({material: {opacity: 0.5}}));
    expect(mesh.renderOrder).toBe(RenderOrder.TRANSLUCENT);
  });

  test("isn't added to its viewport's renderables in view when out of view", () => {
    const mesh = meshWith([[-5, -5, -5, 5, 5, 5]], [0, 0, 600]);
    mesh.shaderProgram = {};
    mesh.prepareForView(contextWith());
    expect(mesh.getViewport().renderablesInView).toEqual([]);
  });

  test("draws one level of detail of its geometries", () => {
    // Up close, the full mesh, and not the level for 1000 away.
    const mesh = meshWith([
      [-5, -5, -5, 5, 5, 5],
      [-5, -5, -5, 5, 5, 5],
    ]);
    expect(mesh.copiesToRender[0].lod).toBe(null);
  });
});

describe("Mesh render at worldMatrices", () => {
  // A mesh in a viewport whose camera is at z 300 looking down -Z, with one
  // buffer around its origin, and a program that keeps what it was asked to
  // do: [use], [set, uniform name] for the world matrix, and [draw]. Other
  // uniforms are set, and not kept.
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
    const setNothing = {set1f() {}, set1i() {}, set3fv() {}, set4fv() {}, setMatrix4fv() {}};
    const worldMatrix = {
      ...setNothing,
      setMatrix4fv: () => calls.push(["set", "worldMatrix"]),
    };
    // use returns the program, as ShaderProgram's does.
    mesh.shaderProgram = {
      use() {
        calls.push(["use"]);
        return this;
      },
      uniform: (name) => (name === "worldMatrix" ? worldMatrix : setNothing),
      draw: () => calls.push(["draw"]),
    };
    mesh.prepareForView(contextWith());
    mesh.render(contextWith());
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

  test("uses the program once, and sets each copy's world matrix before drawing it", () => {
    expect(
      callsAt([
        [0, 0, 0],
        [50, 0, -100],
      ])
    ).toEqual([["use"], ["set", "worldMatrix"], ["draw"], ["set", "worldMatrix"], ["draw"]]);
  });
});

describe("Mesh setUniforms with textures", () => {
  // A program that keeps the integer uniforms it was given, by name, and
  // other uniforms are set and not kept; and a context whose gl keeps the
  // texture units it was told to use.
  const program = () => {
    const ints = {};
    const setNothing = {set1f() {}, set1i() {}, set3fv() {}, set4fv() {}, setMatrix4fv() {}};
    return {
      ints,
      uniform: (name) => ({...setNothing, set1i: (value) => (ints[name] = value)}),
    };
  };
  const contextWithGL = () => {
    const units = [];
    const gl = {
      TEXTURE0: 100,
      TEXTURE_2D: 1,
      activeTexture: (unit) => units.push(unit),
      bindTexture() {},
    };
    return {...contextWith(), gl, units};
  };

  test("turns on and binds its Texture children, which tint its colors", () => {
    const mesh = new Mesh({type: "static-mesh", name: "trunk"});
    mesh.add(new Texture(0, "diffusecolor", {name: "bark"}));
    const shader = program();
    const context = contextWithGL();
    mesh.setUniforms(shader, context);
    expect(shader.ints["textures[0].enabled"]).toBe(true);
    expect(shader.ints["textures[0].id"]).toBe(0);
    expect(shader.ints.textureTint).toBe(true);
    expect(context.units).toEqual([100]);
  });

  test("leaves textures alone without any", () => {
    const shader = program();
    const context = contextWithGL();
    new Mesh({type: "static-mesh", name: "cap"}).setUniforms(shader, context);
    expect(shader.ints["textures[0].enabled"]).toBe(undefined);
    expect(shader.ints.textureTint).toBe(undefined);
    expect(context.units).toEqual([]);
  });
});
