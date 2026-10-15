import {traversal} from "@scenic/scene";

// findTarget finds the node a camera attaches to from its target setting,
// {nodeID, boneName}:
// - nodeID: the ID of a node from the scene config, such as a character. Node
//   IDs are unique, so this always picks out one character, even when several
//   share the same model.
// - boneName: the name of a node inside the nodeID node, such as a bone of a
//   character's skeleton. It is only looked up there, where a skeleton's bone
//   names are unique. Without it, the target is the nodeID node itself.
//
// It returns the target node, or null while it does not exist yet: a bone only
// exists once its model has loaded. It looks the node up every time, so it
// finds the new node when a model is rebuilt.
export function findTarget(sceneManager, {nodeID, boneName}) {
  const node = sceneManager.getNodeByID(nodeID);
  return (
    (node && boneName
      ? traversal.findChildDeepBreadthFirst(node, (child) => child.name === boneName)
      : node) ?? null
  );
}
