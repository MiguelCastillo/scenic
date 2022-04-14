export function buildTraversal(buildNode, buildParentNode) {
  // Depth first traversal
  return function dft(child, parent) {
    const sceneNode = buildNode(child, parent);
    const children = child.items?.map(c => dft(c, sceneNode));
    return buildParentNode(sceneNode, children);
  }
}

export function bubbleTraversal(bubbleDown, bubbleUp) {
  // Depth first traversal
  return function dft(child, parent) {
    const updatedChild = bubbleDown(child, parent);
    if (child.items) {
      for (const c of child.items) {
        dft(c, updatedChild);
      }
    }
    bubbleUp(updatedChild, parent);
  }
}

export function occlusionTraversal(occlusionTest, processParentNode) {
  // Depth first traversal
  return function dft(node) {
    const children =  node.items?.filter(child => occlusionTest(child, node)).map(dft);
    return processParentNode(node, children);
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
  const typeKey = type;

  let currentNode = node;
  while (currentNode && !currentNode.childrenByType[typeKey]) {
    currentNode = currentNode.parent;
  }

  if (!currentNode) {
    return [];
  }

  return currentNode.childrenByType[typeKey];
};
