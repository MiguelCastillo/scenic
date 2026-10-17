import {bubbleTraversal} from "./traversal.js";
import {Node} from "./node.js";
import {Scene} from "./scene.js";
import {BufferedEventBus, EventBus} from "./event-bus.js";
import {Viewport} from "./viewport.js";

// What a script gets for input on a channel nobody has published on, or for
// what its channel has none of, such as keys while the scene is paused.
const noInput = {
  keys: new Set(),
  pressed: new Set(),
  mouse: {x: 0, y: 0},
  wheel: {x: 0, y: 0},
  intents: {
    look: {x: 0, y: 0},
    zoom: 0,
    move: {forward: 0, right: 0, up: 0},
    nextCamera: false,
    navigate: {x: 0, y: 0},
    choose: null,
    act: null,
    select: false,
    back: false,
  },
  messages: [],
};

export class SceneManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.scene = new Scene();
    // ui carries messages from the scene to the app's UI, such as a race's
    // lap and time for its HUD (see BufferedEventBus). Nodes and scripts
    // publish what they know as plain data on the channel named by "hud" in
    // their own state, such as {"hud": "race"}, and nothing without one, and
    // the app, which knows what each channel's messages hold, shows them
    // however it likes, so the scene never knows about the page. Messages
    // are output, worked out from the scene's state, so publishing never
    // changes the scene, and it can happen while drawing. runScripts starts
    // each frame's messages, and the app, their receiver, pulls them when it
    // is ready to show them, such as once a frame.
    this.ui = new BufferedEventBus();
    // network carries messages from the scene to the other players in a
    // network game, such as where this player's ship is (see
    // BufferedEventBus). A node's script publishes what the game wants the
    // others to know about it, as plain data, on the channel named by
    // "network" in its node's state, such as {"network": "player"}, and the
    // app, their receiver, pulls the latest message and sends it to the
    // other players, such as a few times a second, without knowing what it
    // holds. The other players' messages come back in through input.
    // runScripts starts each frame's messages.
    this.network = new BufferedEventBus();
    // input carries the players' input into the scene, as events in the
    // order they happened (see EventBus), on a channel for each player: their
    // intents, such as {type: "look", x, y} (see input-intents.js in
    // @scenic/dom), and the keys and mouse themselves for scripts that read
    // them, such as a ship's flight controls: {type: "keydown", code} and
    // {type: "keyup", code}, by KeyboardEvent.code, {type: "mousemove", x, y}
    // and {type: "wheel", x, y}, in pixels, with positive y down. The app
    // publishes the player at its keyboard or screen on "player", and the
    // other players of a network game on channels of their own, their
    // messages as {type: "network", message}.
    // Whoever runs the scene, such as a SceneRunner, is their receiver: it
    // pulls each frame's events and gives runScripts what they add up to.
    this.input = new EventBus();
  }

  getNodeStateByID(id) {
    return this.stateManager.getItemByID(id);
  }

  updateNodeStateByID(id, newState) {
    this.stateManager.updateItemByID(id, newState);
  }

  addNode(node) {
    this.scene.add(node);
    return this;
  }

  removeNode(node) {
    this.scene.remove(node);
    return this;
  }

  // withNodes replaces the scene's nodes. It throws if the nodes break a rule
  // that rendering depends on, so that a bad scene config fails when it is
  // loaded with an error that says what is wrong, instead of rendering
  // nothing:
  // - every viewport has at least one camera.
  // - every camera's projection type is "perspective" or "orthographic".
  withNodes(nodes) {
    this.scene.clear().addItems(nodes);

    for (const viewport of Node.findChildrenByType(this.scene, Viewport)) {
      if (!viewport.cameras.length) {
        throw new Error(
          `viewport "${viewport.name}" has no camera; add an item with "type": "camera" to it`
        );
      }

      for (const camera of viewport.cameras) {
        const type = this.getNodeStateByID(camera.id)?.projection?.type;
        if (type !== "perspective" && type !== "orthographic") {
          throw new Error(
            `camera "${camera.name}" has projection type "${type}"; use "perspective" or "orthographic"`
          );
        }
      }

      viewport.updateActiveCamera(this);
    }

    return this;
  }

  getNodeByID(id) {
    return Node.findChildByID(this.scene, id);
  }

  // dispose releases the GPU resources held by every node in the scene.
  dispose(gl) {
    this.scene.dispose(gl);
  }

  // runScripts runs every node's script for a frame of the scene at ms, the
  // frame's time, parents before children, through the script's update hook.
  // This is where scripts change the scene's state, such as moving a ship,
  // so runScripts runs once a frame, before preRender works out where
  // everything is and render draws it. frame holds anything else the app
  // wants the scripts to see this frame, such as the seconds since the last
  // frame, and it is added to the context the scripts' update gets.
  //
  // frame.input is each input channel's input this frame, {channel: {keys,
  // pressed, mouse, wheel, intents, messages}}: the keys held, the keys
  // that went down, even if they also came up, how far the mouse moved and
  // the wheel scrolled, {x, y}, what the player means, whatever device they
  // used, such as to move through a menu, and the messages a player in a
  // network game sent, in order (see SceneRunner in @scenic/runtime). A
  // script gets the input of the channel named by "input" in its node's
  // state in its context, and "player"'s without one, so a ship can be flown
  // by whichever player its state says.
  //
  // World matrices are worked out by preRender, after the scripts have run,
  // so a script reading another node's world matrix sees where it was last
  // frame.
  //
  // It also starts the frame's messages to the app's UI and to the network
  // (see ui and network).
  runScripts(ms, frame = {}) {
    this.ui.beginFrame();
    this.network.beginFrame();
    const {input = {}, ...rest} = frame;
    const context = {...rest, ms, sceneManager: this};
    const updatePass = bubbleTraversal(
      (node) => {
        if (node.script?.update) {
          const channel = this.getNodeStateByID(node.id)?.input ?? "player";
          node.script.update({...context, ...noInput, ...input[channel]});
        }
        return node;
      },
      () => {}
    );
    this.scene.items.forEach(updatePass);
  }

  // preRender works out where everything is from its state, at ms, the
  // frame's time, such as for animations: it runs every node's preRender,
  // parents before children, so that every world matrix is up to date, such
  // as for a camera following a ship a script just moved (see SceneRunner in
  // @scenic/runtime), and for render. It changes nothing in the state. frame
  // holds anything else the app wants every node to see, and it is added to
  // the context that preRender gets. Nothing in it depends on where the
  // camera is: that is prepareForView's.
  //
  // When we are traversing the scene graph from the root to its leaf nodes
  // (down), we will multiply all the matrices along the path to convert from
  // local space to world space.
  // Local space simply means that each object in the scene graph is
  // positioned relative to the location and rotation of parent nodes. So if
  // you were to draw a random scene graph node directly using its local
  // space, the object will very likely appear in the wrong place on the
  // screen.
  // But we would like to able to render any arbitrary object in the scene
  // graph in any order.  And to do that we have to change its position from
  // relative to absolute; change nodes' local space to world space.
  // There are multiple reasons to do that. In world space (absolute
  // position) we can render any object is any order, which allows us to do
  // things like sorting of object based on spatial positining and collision
  // detection. It can also allows to render any object we need without
  // concerns about depencies on other objects' location in space.
  preRender(ms, gl, frame = {}) {
    this.scene.items.forEach((node) => this.preRenderNode(node, ms, gl, frame));
  }

  // preRenderNode works out where node and everything under it are, the way
  // preRender does for the whole scene, such as for a camera that moved
  // after preRender, and what is attached to it.
  preRenderNode(node, ms, gl, frame = {}) {
    const context = {...frame, gl, ms, sceneManager: this};
    bubbleTraversal(
      (current) => {
        current.preRender(context);
        return current;
      },
      () => {}
    )(node);
  }

  // prepareForView prepares what every node draws for the view through its
  // viewport's active camera, where the camera is this frame, at ms, the
  // frame's time: it runs every node's prepareForView, parents before
  // children, such as a forest choosing which trees to plant around the
  // camera. It runs once preRender has worked out where everything is and
  // the camera has moved, so that it never prepares for where the camera
  // was. frame holds anything else the app wants every node to see, and it
  // is added to the context that prepareForView gets.
  prepareForView(ms, gl, frame = {}) {
    const context = {...frame, gl, ms, sceneManager: this};
    const prepareForViewPass = bubbleTraversal(
      (node) => {
        node.prepareForView(context);
        return node;
      },
      () => {}
    );
    this.scene.items.forEach(prepareForViewPass);
  }

  // render draws the scene where preRender worked out everything is, at ms,
  // the frame's time. It changes nothing in the state, so the same state can
  // be drawn again, as often as needed (see runScripts for changing it). frame
  // holds anything else the app wants every node to see while drawing, and it
  // is added to the context that render gets.
  //
  // Each viewport renders what prepareForView chose for it, its
  // renderablesInView (see render in Viewport). preRender having run first
  // means a renderable can rely on the world matrix of any other node in the
  // scene, such as the camera or the bones of a skeleton, no matter where in
  // the tree that node is.
  render(ms, gl, frame = {}) {
    const context = {...frame, gl, ms, sceneManager: this};
    for (const viewport of Node.findChildrenByType(this.scene, Viewport)) {
      viewport.render(context);
    }
  }
}
