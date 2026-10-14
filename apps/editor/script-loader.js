import * as math from "@scenic/math";
import * as scene from "@scenic/scene";
import * as animation from "@scenic/animation";
import * as renderer from "@scenic/renderer";

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
};

// loadScript fetches a script and runs it the way CommonJS modules run: inside
// a function given require, module and exports. Scripts can bundle any other
// libraries they need with their own build, marking the @scenic packages as
// external so that their bundle requires them from the app. It returns the
// script's factory, from `module.exports = createScript` or, for a bundled ES
// module, its default export.
async function loadScript(src) {
  const response = await fetch(new URL(src, self.location.href).href);
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
// {"src": "scripts/orbit.js", "settings": {...}}. A script's factory takes the
// node and returns the script's hooks (see Node.withScript), so every node
// gets its own instance. src is relative to the editor page, like the shader
// paths, and each script is loaded once however many nodes use it.
export function loadScripts(sceneManager) {
  const factories = {};
  const loads = [];

  const visit = (node) => {
    const src = sceneManager.getNodeStateByID(node.id)?.script?.src;
    if (src) {
      if (!factories[src]) {
        factories[src] = loadScript(src);
      }
      loads.push(factories[src].then((createScript) => node.withScript(createScript(node))));
    }
    node.items.forEach(visit);
  };
  visit(sceneManager.scene);

  return Promise.all(loads);
}
