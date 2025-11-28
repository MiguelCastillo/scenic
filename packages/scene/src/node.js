import {mat4} from "@scenic/math";

import {findChildDeepBreadthFirst, findChildrenDeepBreadthFirst} from "./traversal.js";

const identityMatrix4 = mat4.Matrix4.identity();
let _id = 1;
let _ids = {};
const _nextID = () => (_id += 1);

export class Node {
  constructor({type, name, id}) {
    if (id == null) {
      id = _nextID();
    }

    if (_ids[id]) {
      throw new Error(`duplicate id ${id}. please provide a unique id if you must provide one.`);
    }

    Object.assign(this, {
      type,
      name,
      id,
      items: [],
      childrenByTypeName: {},
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
    const transform = context?.sceneManager?.getNodeStateByID(this.id)?.transform;

    if (transform) {
      this.withLocalMatrix(
        mat4.Matrix4.trs(transform.position, transform.rotation, transform.scale)
      );
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
    let parentWorldMatrix = this.parent.worldMatrix;

    if (localMatrix === identityMatrix4) {
      this.withWorldMatrix(parentWorldMatrix);
    } else {
      this.withWorldMatrix(parentWorldMatrix.multiply(localMatrix));
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

  add(node) {
    if (this.childrenByID[node.id]) {
      // eslint-disable-next-line no-console
      console.warn(`child with ${node.id} is already registered.`);
    }

    this.items.push(node._withParent(this));
    this.childrenByID[node.id] = node;

    // We will be storing all nodes by type to speed up the lookup
    // of nodes in the scene tree
    const typeName = node.type;
    if (!this.childrenByTypeName[typeName]) {
      this.childrenByTypeName[typeName] = [];
    }
    this.childrenByTypeName[typeName].push(node);
    return this;
  }

  addItems(nodes) {
    nodes.forEach((c) => this.add(c));
    return this;
  }

  remove(node) {
    const index = this.items.indexOf(node);
    if (index !== -1) {
      this.items.splice(index, 1);
      const byTypeIndex = this.childrenByTypeName[node.type].indexOf(node);
      if (byTypeIndex !== -1) {
        this.childrenByTypeName[node.type].splice(byTypeIndex, 1);
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

  static findParentByType(sceneNode, ParentType) {
    let parent = sceneNode.parent;
    while (parent && !(parent instanceof ParentType)) {
      parent = parent.parent;
    }
    return parent;
  }

  // Breadth first search!
  static findChildrenByType(sceneNode, ChildType) {
    return findChildrenDeepBreadthFirst(sceneNode, (x) => x instanceof ChildType);
  }

  // Breadth first search!
  static findChildByType(sceneNode, ChildType) {
    return findChildDeepBreadthFirst(sceneNode, (x) => x instanceof ChildType);
  }

  static findChildByID(sceneNode, ID) {
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
}

export function _clearIDsForTests() {
  _id = 0;
  _ids = {};
}
