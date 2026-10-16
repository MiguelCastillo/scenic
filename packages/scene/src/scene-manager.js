import {bubbleTraversal} from "./traversal.js";
import {Node} from "./node.js";
import {Scene} from "./scene.js";
import {UiBus} from "./ui-bus.js";
import {Viewport} from "./viewport.js";

export class SceneManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.scene = new Scene();
    // Messages from the scene to the app's UI, such as a race's HUD (see
    // UiBus).
    this.ui = new UiBus();
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
  // since the last frame or the keys being held, and it is added to the
  // context update gets.
  //
  // World matrices are only worked out by render, so a script reading
  // another node's world matrix sees where it was last drawn.
  //
  // It also starts the frame's messages to the app's UI (see UiBus), which
  // render sends.
  update(ms, frame = {}) {
    this.ui.beginFrame();
    const context = {...frame, ms, sceneManager: this};
    const updatePass = bubbleTraversal(
      (node) => {
        node.script?.update?.(context);
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
    // for it, once (see UiBus).
    this.ui.flush();
  }
}
