import * as mat4 from "../math/matrix4.js";

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
    let modelMatrix;

    if (nodeState?.transform) {
      const transform = nodeState.transform;
      modelMatrix = mat4.Matrix4.identity()
        .translate(transform.position[0], transform.position[1], transform.position[2])
        .rotate(transform.rotation[0], transform.rotation[1], transform.rotation[2])
        .scale(transform.scale[0], transform.scale[1], transform.scale[2]);

      if (node.parent) {
        modelMatrix = node.parent.worldMatrix.multiply(modelMatrix);
      }
    } else {
      modelMatrix = node.parent ?
        node.parent.worldMatrix :
        mat4.Matrix4.identity();
    }

    node.withMatrix(modelMatrix);
  }

  render() {}

  withMatrix(matrix) {
    this.worldMatrix = matrix;
    return this;
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
}
