import {bubbleTraversal} from "./traversal.js";
import {Node, findChildByID} from "./node.js";

export class SceneManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.document = new Node({type: "document"});
  }

  getNodeStateByID(id) {
    return this.stateManager.getItemByID(id);
  }

  updateNodeStateByID(id, newState) {
    this.stateManager.updateItemByID(id, newState);
  }

  addNode(node) {
    this.document.add(node);
    return this;
  }

  removeNode(node) {
    this.document.remove(node);
    return this;
  }

  withSceneNodes(nodes) {
    this.document.clear().addItems(nodes);
    return this;
  }

  getNodeByID(id) {
    return findChildByID(this.document, id);
  }

  render(ms, gl) {
    const context = {
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
    const bubbleDown = (node /*, parent*/) => {
      node.preRender(context);
      return node;
    };

    // We can render on the way up
    const bubbleUp = (node) => {
      node.render(context);
    };

    const traverse = bubbleTraversal(bubbleDown, bubbleUp);
    this.document.items.forEach(traverse);
  }
}
