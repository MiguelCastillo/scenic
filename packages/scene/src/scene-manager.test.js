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
    update: () => calls.push(`${name}.script.update`),
    render: () => calls.push(`${name}.script.render`),
    dispose: () => calls.push(`${name}.script.dispose`),
  });
}

describe("scripts", () => {
  test("update parents first, and nothing else", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.update(0);

    expect(calls).toEqual(["parent.script.update", "child.script.update"]);
  });

  test("render after their node, children first, without updating", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.render(0, null);

    expect(calls).toEqual([
      "parent.preRender",
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

    expect(() => {
      sceneManager.update(0);
      sceneManager.render(0, null);
    }).not.toThrow();
  });
});

describe("ui", () => {
  test("tells listeners about messages until they stop", () => {
    const sceneManager = new SceneManager(new StateManager([]));
    const messages = [];
    const stop = sceneManager.ui.onUpdate((channel, message) => messages.push([channel, message]));

    sceneManager.ui.publish("race", {lap: 1});
    stop();
    sceneManager.ui.publish("race", {lap: 2});

    expect(messages).toEqual([["race", {lap: 1}]]);
  });
});
