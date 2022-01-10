import * as mat4 from "./math/matrix4.js";
import {bubbleTraversal} from "./scene/traversal.js";

export class SceneManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.rootNodes = [];
  }

  getNodeStateByName(name) {
    return this.stateManager.getItemByName(name);
  }

  updateNodeStateByName(name, newState) {
    this.stateManager.updateItemByName(name, newState);
  }

  addNode(node) {
    this.rootNodes.push(node);
    return this;
  }

  removeNode(node) {
    const idx = this.rootNodes.indexOf(node);
    if (idx !== -1) {
      this.rootNodes.splice(idx+1, 1);
    }
    return this;
  }

  withSceneNodes(nodes) {
    this.rootNodes = nodes;
    return this;
  }

  getNodeByName(name) {
    const nodeGroups = [this.rootNodes];

    for (const nodes of nodeGroups) {
      for (const node of nodes) {
        if (node.name === name) {
          return node;
        }

        const {items=[]} = node;
        if (items.length) {
          nodeGroups[nodeGroups.length] = items;
        }
      }
    }
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
      const {parent} = node;
      const nodeState = this.getNodeStateByName(node.name);
      let modelMatrix;

      if (nodeState) {
        const {transform} = nodeState;
        modelMatrix = mat4.Matrix4
          .translation(...transform.position)
          .rotation(...transform.rotation)
          .scale(...transform.scale);

        if (parent) {
          modelMatrix = parent.worldMatrix.multiply(modelMatrix);
        }
      } else {
        modelMatrix = parent ?
          parent.worldMatrix :
          mat4.Matrix4.identity();
      }

      node.withMatrix(modelMatrix);
      node.preRender(context);
      return node;
    }

    // We can render on the way up
    const bubbleUp = (node) => {
      node.render(context);
    };

    const traverse = bubbleTraversal(bubbleDown, bubbleUp);
    this.rootNodes.map(traverse);
  }
}
