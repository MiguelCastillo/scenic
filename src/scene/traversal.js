export function treeTraversal(transformNode, transformParentNode) {
  return function traverse(child, parent) {
    const {items=[]} = child;
    const sceneNode = transformNode(child, parent);
    const children = items.map(c => traverse(c, sceneNode));
    return transformParentNode(sceneNode, children);
  }
}

export function bubbleTraversal(bubbleDown, bubbleUp) {
  return function traverse(child, parent) {
    const {items=[]} = child;
    const updatedChild = bubbleDown(child, parent);
    items.forEach(c => traverse(c, updatedChild));
    bubbleUp(updatedChild, parent);
  }
}

export function occlusionTraversal(occlusionTest, processParentNode) {
  return function traverse(parent) {
    const {items=[]} = parent;
    const children =  items
      .filter(child => occlusionTest(child, parent))
      .map(child => traverse(child))

    return processParentNode(parent, children);
  }
}

export function treeGetMatches(matcher) {
  return function traverse(roots) {
    const result = [];
    const stack = [roots];

    while (stack.length) {
      const items = stack.shift();

      for (const item of items) {
        if (matcher(item)) {
          result.push(item);
        }

        if (item.items && !!item.items.length) {
          stack.push(item.items);
        }
      }
    }

    return result;
  }
}

export const findParentItemsWithItemType = (node, type) => {
  const typeKey = type + "s";

  let currentNode = node;
  while (currentNode && !currentNode.byType[typeKey]) {
    currentNode = currentNode.parent;
  }

  if (!currentNode) {
    return [];
  }

  return currentNode.byType[typeKey];
};  
