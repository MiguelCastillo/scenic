import {traversal} from "@scenic/scene";

// createTargetFinder returns findTarget({nodeID, boneName}), which finds the
// node a camera behavior attaches to from a target setting:
// - nodeID: the ID of a node from the scene config, such as a character. Node
//   IDs are unique, so this always picks out one character, even when several
//   share the same model.
// - boneName: the name of a node inside the nodeID node, such as a bone of a
//   character's skeleton. It is only looked up there, where a skeleton's bone
//   names are unique. Without it, the target is the nodeID node itself.
//
// findTarget returns the target node, or null while it does not exist yet: a
// bone only exists once its model has loaded. It remembers the node it found,
// and looks it up again whenever it is asked for a different target or the
// node is no longer in the scene, which happens when its model is rebuilt.
export function createTargetFinder(sceneManager) {
  let target = null;
  let foundFor = null;

  // A removed node may still have a parent, because removing a model only
  // detaches its top-level nodes, so the node is checked all the way up.
  const isInScene = (node) => {
    while (node.parent) {
      node = node.parent;
    }
    return node === sceneManager.scene;
  };

  return function findTarget({nodeID, boneName}) {
    const isCurrent =
      target && foundFor.nodeID === nodeID && foundFor.boneName === boneName && isInScene(target);

    if (!isCurrent) {
      const node = sceneManager.getNodeByID(nodeID);
      target =
        (node && boneName
          ? traversal.findChildDeepBreadthFirst(node, (child) => child.name === boneName)
          : node) ?? null;
      foundFor = {nodeID, boneName};
    }

    return target;
  };
}
