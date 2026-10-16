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
  // createScene is a scene with a node that publishes what it is given on
  // "race" when it updates, and its messages, which listeners get.
  function createScene() {
    const node = new Node({name: "race", id: "race"});
    let publish = null;
    node.withScript({
      update: ({sceneManager}) => publish && sceneManager.ui.publish("race", publish),
    });
    const sceneManager = new SceneManager(new StateManager([])).withNodes([node]);
    const messages = [];
    const stop = sceneManager.ui.onUpdate((frame) => messages.push(frame));
    return {sceneManager, messages, stop, publish: (message) => (publish = message)};
  }

  test("sends a frame's last message on each channel once it is drawn", () => {
    const {sceneManager, messages, publish} = createScene();
    publish({lap: 1});
    sceneManager.update(0);
    sceneManager.ui.publish("race", {lap: 2});
    expect(messages).toEqual([]);

    sceneManager.render(0, null);

    expect(messages).toEqual([{race: {lap: 2}}]);
  });

  test("leaves out channels that stopped publishing", () => {
    const {sceneManager, messages, publish} = createScene();
    publish({lap: 1});
    sceneManager.update(0);
    sceneManager.render(0, null);
    publish(null);
    sceneManager.update(0);
    sceneManager.render(0, null);

    expect(messages).toEqual([{race: {lap: 1}}, {}]);
  });

  test("sends the same frame's messages again when drawn again", () => {
    const {sceneManager, messages, publish} = createScene();
    publish({lap: 1});
    sceneManager.update(0);
    sceneManager.render(0, null);
    sceneManager.render(0, null);

    expect(messages).toEqual([{race: {lap: 1}}, {race: {lap: 1}}]);
  });

  test("stops telling listeners that stop", () => {
    const {sceneManager, messages, stop, publish} = createScene();
    publish({lap: 1});
    stop();
    sceneManager.update(0);
    sceneManager.render(0, null);

    expect(messages).toEqual([]);
  });
});
