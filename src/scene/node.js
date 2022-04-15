import * as mat4 from "../math/matrix4.js";
import {
  findChildDeepBreadthFirst,
  findChildrenDeepBreadthFirst
} from "./traversal.js";

const identityMatrix4 = mat4.Matrix4.identity();

export class Node {
  constructor({type, name}) {
    Object.assign(this, {
      type, name,
      items: [],
      childrenByType: {},
    });
  }

  _withParent(parent) {
    this.parent = parent;
    return this;
  }

  // preRender is a hook that is called when the scene tree is traversing down.
  preRender(context) {
    const node = this;
    const nodeState = context.sceneManager.getNodeStateByName(node.name);

    // LocalMatrix is also known as a ModelMatrix. This matrix is a transform
    // matrix with origin at [0,0,0] and relies on the parent world matrix
    // to determine the locaton in world space. That is, absolute position
    // so that coordinates can be rendered without depending on ancestry. That
    // absolute matrix is the world matrix.
    let localMatrix = identityMatrix4;
    let worldMatrix;

    if (nodeState?.transform) {
      const transform = nodeState.transform;
      localMatrix = mat4.Matrix4.trs(
        transform.position,
        transform.rotation,
        transform.scale);
    }

    if (node.parent?.worldMatrix) {
      worldMatrix = localMatrix === identityMatrix4 ?
        node.parent.worldMatrix :
        node.parent.worldMatrix.multiply(localMatrix);
    } else {
      worldMatrix = localMatrix;
    }

    node
      .withLocalMatrix(localMatrix)
      .withWorldMatrix(worldMatrix);
  }

  render() {}

  withLocalMatrix(matrix) {
    this.localMatrix = matrix;
    return this;
  }

  withWorldMatrix(matrix) {
    this.worldMatrix = matrix;
    return this;
  }

  // withMatrix set the world matrix also known as global matrix.
  withMatrix(matrix) {
    return this.withWorldMatrix(matrix);
  }

  add(node) {
    this.items.push(node._withParent(this));

    // We will be storing all nodes by type to speed up the lookup
    // of nodes in the scene tree
    const typeKey = node.type;
    if (!this.childrenByType[typeKey]) {
      this.childrenByType[typeKey] = [];
    }

    this.childrenByType[typeKey].push(node);
    return this;
  }

  addItems(nodes) {
    nodes.forEach(c => this.add(c));
    return this;
  }

  remove(node) {
    const index = this.items.indexOf(node);
    if (index !== -1) {
      this.items.splice(index, 1);
      const byTypeIndex = this.childrenByType[node.type].indexOf(node);
      if (byTypeIndex !== -1) {
        this.childrenByType[node.type].splice(byTypeIndex, 1);
      }

      node._withParent(null);
    }
    return this;
  }

  clear() {
    const items = [...this.items];
    for (const node of items) {
      this.remove(node);
    }
    return this;
  }
}

export function findParentByType(sceneNode, ParentType) {
  let parent = sceneNode.parent;
  while (parent && !(parent instanceof ParentType)) {
    parent = parent.parent;
  }
  return parent;
}

// Breadth first search!
export function findChildrenByType(sceneNode, ChildType) {
  return findChildrenDeepBreadthFirst(sceneNode, (x) => x instanceof ChildType);
}

// Breadth first search!
export function findChildByType(sceneNode, ChildType) {
  return findChildDeepBreadthFirst(sceneNode, (x) => x instanceof ChildType);
}
