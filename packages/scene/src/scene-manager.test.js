import {Camera} from "./camera.js";
import {Node} from "./node.js";
import {SceneManager} from "./scene-manager.js";
import {StateManager} from "./state-manager.js";
import {Viewport} from "./viewport.js";

// createTrackedNode returns a node that records its own hooks and its
// script's hooks, in the order they run, into calls.
function createTrackedNode(name, calls) {
  const node = new Node({name, id: name});
  node.preRender = () => calls.push(`${name}.preRender`);
  node.prepareForView = () => calls.push(`${name}.prepareForView`);
  node.render = () => calls.push(`${name}.render`);
  return node.withScript({
    update: () => calls.push(`${name}.script.update`),
    dispose: () => calls.push(`${name}.script.dispose`),
  });
}

describe("scripts", () => {
  test("update parents first, and nothing else", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.runScripts(0);

    expect(calls).toEqual(["parent.script.update", "child.script.update"]);
  });

  test("preRender parents first, without updating or rendering", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.preRender(0, null);

    expect(calls).toEqual(["parent.preRender", "child.preRender"]);
  });

  test("preRender one node and what is under it", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    const child = createTrackedNode("child", calls);
    parent.add(child);
    child.add(createTrackedNode("grandchild", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.preRenderNode(child, 0, null);

    expect(calls).toEqual(["child.preRender", "grandchild.preRender"]);
  });

  test("prepare for the view parents first, and nothing else", () => {
    const calls = [];
    const parent = createTrackedNode("parent", calls);
    parent.add(createTrackedNode("child", calls));
    const sceneManager = new SceneManager(new StateManager([])).withNodes([parent]);

    sceneManager.prepareForView(0, null);

    expect(calls).toEqual(["parent.prepareForView", "child.prepareForView"]);
  });

  test("aren't run by render, which only asks each viewport to render", () => {
    const calls = [];
    const viewport = new Viewport({name: "world", id: "world"}).add(
      new Camera({name: "camera", id: "camera"})
    );
    viewport.render = () => calls.push("world.render");
    viewport.add(createTrackedNode("ship", calls));
    const sceneManager = new SceneManager(
      new StateManager([{id: "camera", projection: {type: "perspective"}}])
    ).withNodes([viewport]);

    sceneManager.render(0, null);

    expect(calls).toEqual(["world.render"]);
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
      sceneManager.runScripts(0);
      sceneManager.preRender(0, null);
      sceneManager.prepareForView(0, null);
      sceneManager.render(0, null);
    }).not.toThrow();
  });
});

describe("ui and network", () => {
  // createScene is a scene with a node that publishes what it is given on
  // "race" of ui and "player" of network when it updates.
  function createScene() {
    const node = new Node({name: "race", id: "race"});
    let publish = null;
    node.withScript({
      update: ({sceneManager}) => {
        if (publish) {
          sceneManager.ui.publish("race", publish);
          sceneManager.network.publish("player", publish);
        }
      },
    });
    const sceneManager = new SceneManager(new StateManager([])).withNodes([node]);
    return {sceneManager, publish: (message) => (publish = message)};
  }

  test("keep the last message on each channel for receivers to pull", () => {
    const {sceneManager, publish} = createScene();
    publish({lap: 1});
    sceneManager.runScripts(0);
    sceneManager.ui.publish("race", {lap: 2});

    expect(sceneManager.ui.messages()).toEqual({race: {lap: 2}});
    expect(sceneManager.ui.latest("race")).toEqual({lap: 2});
    expect(sceneManager.network.latest("player")).toEqual({lap: 1});

    // Pulling forgets nothing, and drawing changes nothing.
    sceneManager.render(0, null);
    expect(sceneManager.ui.latest("race")).toEqual({lap: 2});
  });

  test("leave out channels that stopped publishing", () => {
    const {sceneManager, publish} = createScene();
    publish({lap: 1});
    sceneManager.runScripts(0);
    publish(null);
    sceneManager.runScripts(0);

    expect(sceneManager.ui.messages()).toEqual({});
    expect(sceneManager.network.latest("player")).toBeUndefined();
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

    sceneManager.runScripts(0, {
      input: {
        player: {keys: new Set(["ArrowLeft"]), pressed: new Set(), mouse: {x: 0, y: 0}},
        "player 2": {keys: new Set(["ArrowRight"]), pressed: new Set(), mouse: {x: 0, y: 0}},
      },
    });

    expect(seen).toEqual({"ship 1": ["ArrowLeft"], "ship 2": ["ArrowRight"]});
  });
});
