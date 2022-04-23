import * as mat4 from "../math/matrix4.js";
import {
  findChildDeepBreadthFirst,
  findChildrenDeepBreadthFirst
} from "./traversal.js";

const identityMatrix4 = mat4.Matrix4.identity();
let _id = 0;
let _ids = {};
const _getID = () => (_ids[++_id]=_id);

export class Node {
  constructor({type, name, id}) {
    if (id != null) {
      if (_id[id]) {
        throw new Error(`duplicate id ${id}. please provide a unique id if you must provide one.`);
      }
    } else {
      id = _getID();
    }

    Object.assign(this, {
      type, name, id,
      items: [],
      childrenByType: {},
      childrenByID: {},
      localMatrix: identityMatrix4,
      worldMatrix: identityMatrix4,
    });
  }

  _withParent(parent) {
    this.parent = parent;
    return this;
  }

  // preRender is a hook that is called when the scene tree is traversing down.
  preRender(context) {
    const node = this;
    const transform = context?.sceneManager?.getNodeStateByID(node.id)?.transform;

    if (transform) {
      node.withLocalMatrix(mat4.Matrix4.trs(
        transform.position,
        transform.rotation,
        transform.scale));
    }

    // LocalMatrix is also known as a ModelMatrix. This matrix is a transform
    // matrix in the space of the node and it is usually with origin [0,0,0].
    // Local matrix relies on parent world matrix to figure the location of the
    // in world space.
    // So what does all this mean?
    // If you have a model with a body, arms, and fingers each at center[0,0,0]
    // in local space, they are all render on top of each other at 0,0,0.
    // For all those parts to be drawn in the proper place (assuming that they
    // are in a hierarchy) you need to multiple the parent world matrices with
    // local node matrices so that each node is rendered relative to each other,
    // very similar to absolute positiong in CSS.
    let localMatrix = this.localMatrix;

    // Root nodes don't have a parent node so there is not parent world matrix.
    let parentWorldMatrix = node.parent?.worldMatrix;

    if (parentWorldMatrix) {
      if (localMatrix !== identityMatrix4) {
        node.withWorldMatrix(parentWorldMatrix.multiply(localMatrix));
      } else {
        node.withWorldMatrix(parentWorldMatrix);
      }
    } else if (localMatrix !== identityMatrix4) {
      node.withWorldMatrix(localMatrix);
    }
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
    if (this.childrenByID[node.id]) {
      // eslint-disable-next-line no-console
      console.warn(`child with ${node.id} is already registered.`);
    }

    this.items.push(node._withParent(this));
    this.childrenByID[node.id] = node;

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

      delete this.childrenByID[node.id];
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

export function findChildByID(sceneNode, ID) {
  const groups = [[sceneNode]];
  for (const nodes of groups) {
    for (const node of nodes) {
      if (node.childrenByID[ID]) {
        return node.childrenByID[ID];
      }

      if (node.items.length) {
        groups[groups.length] = node.items;
      }
    }
  }
}

export function _clearIDsForTests() {
  _id = 0;
  _ids = {};
}
