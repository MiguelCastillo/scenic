import {Node} from "./node.js";
import {SceneManager} from "./scene-manager.js";
import {StateManager} from "./state-manager.js";

// createTrackedNode returns a node that records its own hooks and its
// script's hooks, in the order they run, into calls.
function createTrackedNode(name, calls) {
  const node = new Node({name, id: name});
  node.preRender = () => calls.push(`${name}.preRender`);
  node.render = () => calls.push(`${name}.render`);
  return node.withScript({
    preRender: () => calls.push(`${name}.script.preRender`),
    render: () => calls.push(`${name}.script.render`),
    dispose: () => calls.push(`${name}.script.dispose`),
  });
}

describe("scripts", () => {
  test("run their hooks around their node's, parents first then children first", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.render(0, null);

    expect(calls).toEqual([
      "parent.script.preRender",
      "parent.preRender",
      "child.script.preRender",
      "child.preRender",
      "child.render",
      "child.script.render",
      "parent.render",
      "parent.script.render",
    ]);
  });

  test("are disposed with their node", () => {
    const calls = [];
    const sceneManager = new SceneManager(new StateManager([])).withNodes([
      createTrackedNode("light", calls),
    ]);

    sceneManager.dispose(null);

    expect(calls).toEqual(["light.script.dispose"]);
  });

  test("can leave out hooks they do not need", () => {
    const node = new Node({name: "light", id: "light"}).withScript({});
    const sceneManager = new SceneManager(new StateManager([])).withNodes([node]);

    expect(() => sceneManager.render(0, null)).not.toThrow();
  });
});
