import {bubbleTraversal} from "./traversal.js";
import {Node} from "./node.js";
import {Scene} from "./scene.js";
import {BufferedEventBus, EventBus} from "./event-bus.js";
import {Viewport} from "./viewport.js";

// What a script gets for input on a channel nobody has published on.
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
    select: false,
    back: false,
  },
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
    // changes the scene, and it can happen while drawing. update starts each
    // frame's messages, and render sends them once the frame is drawn.
    this.ui = new BufferedEventBus();
    // input carries the players' input into the scene, as events in the
    // order they happened (see EventBus), on a channel for each player: their
    // intents, such as {type: "look", x, y} (see input-intents.js in
    // @scenic/dom), and the keys and mouse themselves for scripts that read
    // them, such as a ship's flight controls: {type: "keydown", code} and
    // {type: "keyup", code}, by KeyboardEvent.code, {type: "mousemove", x, y}
    // and {type: "wheel", x, y}, in pixels, with positive y down. The app
    // publishes the player at its keyboard or screen on "player", and a
    // network game could publish other players on channels of their own.
    // Whoever runs the scene, such as a SceneRunner, reads each frame's
    // events and gives update what they add up to.
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

  // update runs every node's script for a frame of the scene at ms, the
  // frame's time, parents before children, through the script's update hook.
  // This is where scripts change the scene's state, such as moving a ship,
  // so update runs once a frame, before render draws it. frame holds anything
  // else the app wants the scripts to see this frame, such as the seconds
  // since the last frame, and it is added to the context update gets.
  //
  // frame.input is each input channel's input this frame, {channel: {keys,
  // pressed, mouse, wheel, intents}}: the keys held, the keys that went
  // down, even if they also came up, how far the mouse moved and the wheel
  // scrolled, {x, y}, and what the player means, whatever device they used,
  // such as to move through a menu (see SceneRunner in @scenic/runtime). A script gets the
  // input of the channel named by "input" in its node's state as keys,
  // pressed and mouse in its context, and "player" without one, so a ship
  // can be flown by whichever player its state says.
  //
  // World matrices are only worked out by render, so a script reading
  // another node's world matrix sees where it was last drawn.
  //
  // It also starts the frame's messages to the app's UI (see ui), which
  // render sends.
  update(ms, frame = {}) {
    this.ui.beginFrame();
    const {input = {}, ...rest} = frame;
    const context = {...rest, ms, sceneManager: this};
    const updatePass = bubbleTraversal(
      (node) => {
        if (node.script?.update) {
          const channel = this.getNodeStateByID(node.id)?.input ?? "player";
          node.script.update({...context, ...(input[channel] ?? noInput)});
        }
        return node;
      },
      () => {}
    );
    this.scene.items.forEach(updatePass);
  }

  // render draws the scene as its state has it, at ms, the frame's time, such
  // as for animations. It changes nothing in the state, so the same state can
  // be drawn again, as often as needed (see update for changing it). frame
  // holds anything else the app wants every node to see while drawing, and it
  // is added to the context that preRender and render get.
  render(ms, gl, frame = {}) {
    const context = {
      ...frame,
      gl,
      ms,
      sceneManager: this,
      // Translucent meshes, which are drawn after everything else (see
      // Mesh.render), as {distance, draw}.
      translucent: [],
    };

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
    //
    // The scene is walked twice. The first pass runs every preRender, parents
    // before children, so that every world matrix is up to date. The second
    // pass runs every render, children before parents, so that children such
    // as Geometry fill their parent's draw list before the parent draws.
    // Finishing the first pass before starting the second means a node that
    // renders can rely on the world matrix of any other node in the scene,
    // such as the camera or the bones of a skeleton, no matter where in the
    // tree that node is.
    //
    // A node's script, if it has one, can also draw: its render runs just
    // after the node's. It is called here rather than from Node so that every
    // node type gets it, including types whose render does not call
    // super.render.
    const preRenderPass = bubbleTraversal(
      (node) => {
        node.preRender(context);
        return node;
      },
      () => {}
    );

    const renderPass = bubbleTraversal(
      (node) => node,
      (node) => {
        node.render(context);
        node.script?.render?.(context);
      }
    );

    this.scene.items.forEach(preRenderPass);
    this.scene.items.forEach(renderPass);

    // Translucent meshes are drawn last, once everything solid is in the
    // depth buffer, and farthest first, so that each is blended over what is
    // behind it. They don't write depth, so they never hide each other.
    if (context.translucent.length) {
      context.translucent.sort((a, b) => b.distance - a.distance);
      gl.enable(gl.BLEND);
      // Only colors are blended: the canvas keeps its own alpha, so that
      // the page never shows through it.
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.depthMask(false);
      context.translucent.forEach(({draw}) => draw());
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Now the frame is drawn, the app's UI hears what the scene published
    // for it, once (see ui).
    this.ui.flush();
  }
}
