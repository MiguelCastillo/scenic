import {Mesh} from "./mesh.js";
import {Node} from "./node.js";

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
