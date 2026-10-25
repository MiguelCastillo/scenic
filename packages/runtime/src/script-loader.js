import * as math from "@scenic/math";
import * as scene from "@scenic/scene";
import * as animation from "@scenic/animation";
import * as renderer from "@scenic/renderer";
import * as physics from "@scenic/physics";

import {versionedURL} from "./versioned-url.js";

// The modules scripts can require, which are the app's own copies of them.
// Scripts get these rather than bundling their own so that they share the
// app's classes: a script's own copy of @scenic/scene would have Node and
// Renderable classes that instanceof checks in the app do not recognize. This
// list is the scripting API, so add to it deliberately.
const scriptModules = {
  "@scenic/math": math,
  "@scenic/scene": scene,
  "@scenic/animation": animation,
  "@scenic/renderer": renderer,
  "@scenic/physics": physics,
};

// loadScript fetches a script and runs it the way CommonJS modules run: inside
// a function given require, module and exports. Scripts can bundle any other
// libraries they need with their own build, marking the @scenic packages as
// external so that their bundle requires them from the app. It returns the
// script's factory, from `module.exports = createScript` or, for a bundled ES
// module, its default export. src is what the scene calls it, and url where
// it is.
async function loadScript(src, url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`unable to load script "${src}": ${response.status} ${response.statusText}`);
  }
  const source = await response.text();

  const require = (name) => {
    if (!Object.prototype.hasOwnProperty.call(scriptModules, name)) {
      throw new Error(
        `script "${src}" requires "${name}", which scripts cannot use. ` +
          `Scripts can require ${Object.keys(scriptModules).join(", ")}.`
      );
    }
    return scriptModules[name];
  };

  // sourceURL names the code after the script, so that stack traces and the
  // debugger show where it came from instead of an anonymous function.
  const module = {exports: {}};
  new Function("require", "module", "exports", `${source}\n//# sourceURL=${src}`)(
    require,
    module,
    module.exports
  );

  const {exports} = module;
  return typeof exports === "function" ? exports : exports.default;
}

// loadScripts attaches scripts to the nodes whose config has a "script":
// {"src": "/resources/scripts/orbit.js", "settings": {...}}. A script's factory takes the
// node and returns the script's hooks (see Node.withScript), so every node
// gets its own instance. src is relative to baseURL, the scene file's URL,
// the way a page's links are relative to the page, so a scene finds the
// scripts next to it whichever app runs it. It is the app's page by
// default. Each script is loaded once however many nodes use it.
//
// Options:
// - root: where in the scene to look, such as a node just added to it. The
//   whole scene by default.
// - factoriesByURL: the scripts already loaded, by their full URL, as
//   promises of their factories, which this adds to, so that a scene that
//   keeps one loads each script once however often nodes are added to it,
//   such as a ship's parts every time another ship is shown. A script that
//   fails to load isn't kept, so it is tried again next time. A new one by
//   default.
// - version: the version scripts are asked for at (see versionedURL), or
//   null. null by default.
export function loadScripts(
  sceneManager,
  baseURL = globalThis.location?.href,
  {root = sceneManager.scene, factoriesByURL = new Map(), version = null} = {}
) {
  const loads = [];

  const visit = (node) => {
    const src = sceneManager.getNodeStateByID(node.id)?.script?.src;
    if (src) {
      const url = versionedURL(new URL(src, baseURL).href, version);
      if (!factoriesByURL.has(url)) {
        const loading = loadScript(src, url);
        loading.catch(() => factoriesByURL.delete(url));
        factoriesByURL.set(url, loading);
      }
      loads.push(
        factoriesByURL.get(url).then((createScript) => node.withScript(createScript(node)))
      );
    }
    node.items.forEach(visit);
  };
  visit(root);

  return Promise.all(loads);
}
