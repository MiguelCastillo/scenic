export class Node {
  constructor({type, name}) {
    Object.assign(this, {
      type, name,
      items: [],
      byType: {},
    });
  }

  _withParent(parent) {
    this.parent = parent;
    return this;
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
    const typeKey = node.type + "s";
    if (!this.byType[typeKey]) {
      this.byType[typeKey] = [];
    }

    this.byType[typeKey].push(node);

    return this;
  }

  addItems(nodes) {
    nodes.forEach(c => this.add(c));
    return this;
  }
}
