import {bubbleTraversal} from "./traversal.js";
import {Node} from "./node.js";
import {Scene} from "./scene.js";
import {Viewport} from "./viewport.js";

export class SceneManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.scene = new Scene();
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

  // render draws a frame of the scene at ms, the frame's time. frame holds
  // anything else the app wants every node and script to see this frame, such
  // as the seconds since the last frame or the keys being held, and it is
  // added to the context that preRender and render get.
  render(ms, gl, frame = {}) {
    const context = {
      ...frame,
      gl,
      ms,
      sceneManager: this,
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
    // A node's script, if it has one, gets the same hooks: its preRender runs
    // just before the node's, so that changes it makes to the node's state show
    // up in this frame, and its render runs just after the node's. The hooks
    // are called here rather than from Node so that every node type gets them,
    // including types whose preRender does not call super.preRender.
    const preRenderPass = bubbleTraversal(
      (node) => {
        node.script?.preRender?.(context);
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
  }
}
