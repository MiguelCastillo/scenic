import {Node, SceneManager, StateManager} from "@scenic/scene";

import {findTarget} from "./target.js";

// createCharacter builds a character node with a small skeleton: a hips node
// with a head node under it.
function createCharacter(id) {
  const hips = new Node({name: "Hips"});
  const head = new Node({name: "Head"});
  hips.add(head);
  return {character: new Node({name: id, id}).add(hips), hips, head};
}

function createSceneManager(nodes) {
  return new SceneManager(new StateManager([])).withNodes(nodes);
}

describe("findTarget", () => {
  test("finds the bone named boneName inside the nodeID node", () => {
    const dancer = createCharacter("dancer");
    const sceneManager = createSceneManager([dancer.character]);

    expect(findTarget(sceneManager, {nodeID: "dancer", boneName: "Head"})).toBe(dancer.head);
  });

  test("finds the bone of the character nodeID names when characters share bone names", () => {
    const first = createCharacter("first");
    const second = createCharacter("second");
    const sceneManager = createSceneManager([first.character, second.character]);

    expect(findTarget(sceneManager, {nodeID: "second", boneName: "Head"})).toBe(second.head);
    expect(findTarget(sceneManager, {nodeID: "first", boneName: "Head"})).toBe(first.head);
  });

  test("finds the nodeID node itself when there is no boneName", () => {
    const car = new Node({name: "car", id: "car"});
    const sceneManager = createSceneManager([car]);

    expect(findTarget(sceneManager, {nodeID: "car"})).toBe(car);
  });

  test("returns null until the bone exists, then finds it", () => {
    const character = new Node({name: "dancer", id: "dancer"});
    const sceneManager = createSceneManager([character]);

    expect(findTarget(sceneManager, {nodeID: "dancer", boneName: "Head"})).toBeNull();

    const head = new Node({name: "Head"});
    character.add(new Node({name: "Hips"}).add(head));

    expect(findTarget(sceneManager, {nodeID: "dancer", boneName: "Head"})).toBe(head);
  });

  test("finds the new bone after the character's model is rebuilt", () => {
    const dancer = createCharacter("dancer");
    const sceneManager = createSceneManager([dancer.character]);
    expect(findTarget(sceneManager, {nodeID: "dancer", boneName: "Head"})).toBe(dancer.head);

    // Rebuilding a model only detaches its top-level nodes, so the old head
    // still has a parent.
    dancer.character.clear();
    const newHead = new Node({name: "Head"});
    dancer.character.add(new Node({name: "Hips"}).add(newHead));

    expect(dancer.head.parent).not.toBeNull();
    expect(findTarget(sceneManager, {nodeID: "dancer", boneName: "Head"})).toBe(newHead);
  });
});
