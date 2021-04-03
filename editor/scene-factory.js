import {Node as SceneNode} from "../src/scene/node.js";
import {Light as SceneLight} from "../src/scene/light.js";
import {StaticMesh} from "../src/scene/static-mesh.js";
import {SceneManager, treeTraversal, treeGetMatches} from "../src/scene-manager.js";
import {StateManager} from "../src/state-manager.js";
import {
  createRenderableShaderProgram,
  createPointShaderProgram,
} from "./shaders.js";

export function createScene(gl, config) {
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
  const sceneManager = new SceneManager();

  const renderableShaderProgram = createRenderableShaderProgram(gl, new Array(8).fill(0))
    .addAttributes([
      {
        name: "color",
      }, {
        name: "normal",
      }, {
        name: "position",
      },
    ]);

  const lightSourceProgramShader = createPointShaderProgram(gl)
    .addAttributes([
      {
        name: "color",
      }, {
        name: "position",
      },
    ]);

  function buildSceneParentNode(parent, items) {
    return parent.addItems(items);
  }

  function buildSceneNode(node /*, parent*/) {
    if (node.type === "static-mesh") {
      return new StaticMesh(node).withShaderProgram(renderableShaderProgram);
    }
    else if (node.type === "light") {
      return new SceneLight(node).withShaderProgram(lightSourceProgramShader);
    }

    return new SceneNode(node);
  }

  const traverse = treeTraversal(buildSceneNode, buildSceneParentNode);
  const sceneNodes = stateManager.getItems().map(item => traverse(item));

  return {
    stateManager,
    sceneManager: sceneManager.withSceneNodes(sceneNodes),
  };
}

export function getResourcesFromConfig(config) {
  const traverse = treeGetMatches((node) => {
    return node.type === "static-mesh" || node.type === "light";
  });

  return (
    traverse(config.items)
    .map(item => {
      return {
        node: item,
        url: item.resource,
        filename: item.resource.split(/[\/]/).pop(),
      }
    }));
}
