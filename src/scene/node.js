export class Node {
  constructor({type, name}) {
    Object.assign(this, {
      type, name,
      items: [],
      lights: [],
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

    if (node.type === "light") {
      this.lights.push(node);
    }

    return this;
  }

  addItems(nodes) {
    nodes.forEach(c => this.add(c));
    return this;
  }
}
