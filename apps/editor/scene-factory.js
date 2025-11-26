import {
  Node as SceneNode,
  Light as SceneLight,
  Projection,
  StaticMesh,
  SkinnedMesh,
  SceneManager,
  StateManager,
  traversal,
} from "@scenic/scene";

export function createScene(config) {
  // The state manager is the first thing we create. This is built from all
  // the scene configuation information, and it is used for creating the
  // scene manager itself. The state manager is where the state of the world
  // is actually stored. This is the input to the scene manager so that it
  // can render the current state of the world.
  const stateManager = new StateManager(config.items);

  // The scene manager is the tree of renderables, which uses the state
  // manager as input to determine the state of the world that needs to be
  // rendered. The only state we store in the scene manager is the
  // relationship between all the nodes in the scene tree. A combination
  // of the nodes in the scene tree (stored in the scene manager) and the
  // state manager are ultimately what make up a scene.
  // How it works is that we use the scene manager to traverse all the nodes
  // in the scene reading their state from the state manager to calculate
  // information such as world matrices.
  const sceneManager = new SceneManager(stateManager);

  function buildSceneParentNode(parent, children = []) {
    return parent.addItems(children);
  }

  function buildSceneNode(nodeConfig) {
    if (isStaticMesh(nodeConfig)) {
      return new StaticMesh(nodeConfig);
    } else if (isSkinnedMesh(nodeConfig)) {
      return new SkinnedMesh(nodeConfig);
    } else if (isLight(nodeConfig)) {
      return new SceneLight(nodeConfig);
    } else if (isProjection(nodeConfig)) {
      return new Projection(nodeConfig);
    }

    return new SceneNode(nodeConfig);
  }

  const traverse = traversal.buildTraversal(buildSceneNode, buildSceneParentNode);
  const sceneNode = traverse(config);
  return sceneManager.withSceneNodes(sceneNode.items);
}

export function isProjection(nodeConfig) {
  return nodeConfig.type === "perspective" || nodeConfig.type === "orthographic";
}

export function isLight(nodeConfig) {
  return nodeConfig.type === "light";
}

export function isStaticMesh(nodeConfig) {
  return nodeConfig.type === "static-mesh";
}

export function isSkinnedMesh(nodeConfig) {
  return nodeConfig.type === "skinned-mesh";
}

// buildDefaultState insert default state to scene nodes that need it. This
// makes it simpler in the scene config so that you don't have to worry
// providing boilerplate data.
// A thing this function does as well is insert IDs in the scene configuration
// so that scene nodes that are created with this can be easily cross referenced
export function buildDefaultState(config) {
  const buildNode = (nodeConfig) => {
    const defaults = {
      transform: {
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
        position: [0, 0, 0],
        ...nodeConfig.transform,
      },
    };

    return {
      id: nodeConfig.name,
      ...nodeConfig,
      ...defaults,
    };
  };

  const buildParent = (parent, children) => {
    parent.items = children;
    return parent;
  };

  return traversal.buildTraversal(buildNode, buildParent)(config);
}
