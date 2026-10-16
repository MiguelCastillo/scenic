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

describe("input", () => {
  test("keeps every event of a frame, in order, until taken", () => {
    const sceneManager = new SceneManager(new StateManager([]));
    sceneManager.input.publish("player", {type: "keydown", code: "Space"});
    sceneManager.input.publish("player", {type: "keyup", code: "Space"});

    expect(sceneManager.input.take()).toEqual({
      player: [
        {type: "keydown", code: "Space"},
        {type: "keyup", code: "Space"},
      ],
    });
    expect(sceneManager.input.take()).toEqual({});
  });

  test("gives each script the input of the channel its node names", () => {
    const seen = {};
    const createNode = (id) =>
      new Node({name: id, id}).withScript({update: ({keys}) => (seen[id] = [...keys])});
    const sceneManager = new SceneManager(
      new StateManager([{name: "ship 2", id: "ship 2", input: "player 2"}])
    ).withNodes([createNode("ship 1"), createNode("ship 2")]);

    sceneManager.update(0, {
      input: {
        player: {keys: new Set(["ArrowLeft"]), pressed: new Set(), mouse: {x: 0, y: 0}},
        "player 2": {keys: new Set(["ArrowRight"]), pressed: new Set(), mouse: {x: 0, y: 0}},
      },
    });

    expect(seen).toEqual({"ship 1": ["ArrowLeft"], "ship 2": ["ArrowRight"]});
  });
});
