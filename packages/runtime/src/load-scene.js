//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

import {webgl} from "@scenic/renderer";
import {Node} from "@scenic/scene";

import {createScene, buildDefaultState} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {applyShaders} from "./shader-registry.js";
import {loadScripts} from "./script-loader.js";

// loadScene builds a scene from its config and loads its models, shaders
// and scripts, ready to run (see runScene). It returns the scene: its
// sceneManager, its resourceLoader, and dispose, which tears it down.
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

  try {
    // Renderables that are not loaded from a resource, such as grids, get
    // their shader programs now. The resource loader gives the others theirs
    // once their models are built.
    await Promise.all([
      resourceLoader.loadMany(getResourcesFromConfig(sceneConfig)),
      applyShaders(gl, sceneManager.scene, () => disposed),
      loadScripts(sceneManager, new URL(sceneURL, self.location.href).href),
    ]);
  } catch (ex) {
    // The caller never receives dispose when loading fails, so tear down
    // here; otherwise what was loaded would never be freed.
    dispose();
    throw ex;
  }

  // eslint-disable-next-line
  console.log(`Load time: ${(Date.now() - start) / 1000} secs`);

  return {sceneManager, resourceLoader, dispose};
};
