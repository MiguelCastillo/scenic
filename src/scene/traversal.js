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
