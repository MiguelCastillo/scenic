//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

import {webgl} from "@scenic/renderer";
import {Node} from "@scenic/scene";

import {createScene, buildDefaultState, buildSceneNodes} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {applyShaders} from "./shader-registry.js";
import {loadScripts} from "./script-loader.js";

// loadScene builds a scene from its config and loads its models, shaders
// and scripts, ready to run (see SceneRunner). It returns the scene:
// its sceneManager, its resourceLoader, add and remove, which add nodes to it
// and take them out while it runs, and dispose, which tears it down.
//
// Options:
// - sceneURL: where config came from, such as "/games/bubble-squadron/
//   race.json", which the scene's script paths are relative to. The app's
//   page by default.
export const loadScene = async (gl, config, {sceneURL = self.location.href} = {}) => {
  const {vendor, renderer, limits, contextAttributes} = webgl.getDebugData(gl);

  // eslint-disable-next-line no-console
  console.log("Vendor:", vendor);
  // eslint-disable-next-line no-console
  console.log("Renderer:", renderer);
  // eslint-disable-next-line no-console
  console.log("Limits:", JSON.stringify(limits));
  // eslint-disable-next-line no-console
  console.log("Context:", JSON.stringify(contextAttributes));

  const start = Date.now();

  const sceneConfig = buildDefaultState(config);

  // Let's create the scene, which is made up of a scene manager and a
  // state manager.
  const sceneManager = createScene(sceneConfig);

  // Initialize every node's world matrix, so scripts see where everything is
  // on their first frame.
  Node.findChildrenByType(sceneManager.scene, Node).forEach((node) =>
    Node.prototype.preRender.call(node, {sceneManager})
  );

  // API for loading resources for scene nodes.
  const resourceLoader = createResourceLoader(gl, sceneManager);

  // dispose tears down everything this call set up, including the GPU
  // resources of every node in the scene, so that another scene can be
  // rendered in its place. Whatever runs the scene stops first.
  let disposed = false;
  function dispose() {
    disposed = true;
    resourceLoader.dispose();
    sceneManager.dispose(gl);
  }

  const baseURL = new URL(sceneURL, self.location.href).href;

  // add builds config, a node like those in a scene file with the nodes under
  // it, and adds it to the running scene, such as another player's ship. It
  // goes under the node parentID, or at the top of the scene without one.
  // Every id gets idPrefix in front, so the same config can be added again,
  // such as once for each player, as long as each has its own prefix: with
  // "p2 ", a node named "starfighter body" has the id "p2 starfighter body".
  // Its scripts' paths are relative to the scene file, like the scene's own.
  //
  // It resolves with the added node's id once its models, shaders and
  // scripts are loaded. It is in the scene from the start, so it is drawn as
  // its models arrive, and its scripts run as they arrive. Models the scene
  // already has, such as the player's own ship's, are not fetched again. If
  // loading fails, nothing is added.
  async function add(config, {parentID, idPrefix = ""} = {}) {
    const parent = parentID == null ? sceneManager.scene : sceneManager.getNodeByID(parentID);
    if (!parent) {
      throw new Error(
        `unable to add "${config.name}": there is no node "${parentID}" to add it to`
      );
    }

    const withIDs = (nodeConfig) => ({
      ...nodeConfig,
      id: idPrefix + (nodeConfig.id ?? nodeConfig.name),
      ...(nodeConfig.items && {items: nodeConfig.items.map(withIDs)}),
    });
    const [state] = buildDefaultState({items: [withIDs(config)]}).items;
    sceneManager.stateManager.addItems([state]);

    const node = buildSceneNodes(state);
    parent.add(node);
    [node, ...Node.findChildrenByType(node, Node)].forEach((added) =>
      Node.prototype.preRender.call(added, {sceneManager})
    );

    try {
      await Promise.all([
        resourceLoader.loadMany(getResourcesFromConfig({items: [state]})),
        applyShaders(gl, node, () => disposed),
        loadScripts(sceneManager, baseURL, node),
      ]);
    } catch (ex) {
      remove(state.id);
      throw ex;
    }
    return state.id;
  }

  // remove takes the node id, and the nodes under it, out of the scene and
  // its state, and frees their GPU resources, such as when a player leaves.
  // The nodes under it are the ones in the scene now, including any added
  // under it since, such as a ship's parts. Only remove a node add added once
  // add has resolved.
  function remove(id) {
    const node = sceneManager.getNodeByID(id);
    if (node) {
      [node, ...Node.findChildrenByType(node, Node)].forEach((removed) =>
        sceneManager.stateManager.removeItemByID(removed.id)
      );
      node.parent.remove(node);
      node.dispose(gl);
    }
    sceneManager.stateManager.removeItemByID(id);
  }

  try {
    // Renderables that are not loaded from a resource, such as grids, get
    // their shader programs now. The resource loader gives the others theirs
    // once their models are built.
    await Promise.all([
      resourceLoader.loadMany(getResourcesFromConfig(sceneConfig)),
      applyShaders(gl, sceneManager.scene, () => disposed),
      loadScripts(sceneManager, baseURL),
    ]);
  } catch (ex) {
    // The caller never receives dispose when loading fails, so tear down
    // here; otherwise what was loaded would never be freed.
    dispose();
    throw ex;
  }

  // eslint-disable-next-line
  console.log(`Load time: ${(Date.now() - start) / 1000} secs`);

  return {sceneManager, resourceLoader, add, remove, dispose};
};
