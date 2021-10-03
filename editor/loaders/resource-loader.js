import {treeGetMatches} from "../../src/scene/traversal.js";

import {
  Loader as ObjFileLoader,
  buildSceneNode as objBuildSceneNode
} from "./obj/loader.js";

import {isLight, isStaticMesh} from "../scene-factory.js";

export function createResourceLoader(gl, sceneManager) {
  const cache = {};

  // File loader mappings to file extension.
  const loaderManager = new LoaderManager()
    .register("obj", {
      loader: new ObjFileLoader(),
      buildSceneNode: objBuildSceneNode,
    });

  function loadMany(resources) {
    return Promise.all(
      resources.map((resource) => this.load(resource))
    );
  }

  // Filename is a separate argument because a URL can be from a file selector
  // in which case the URL object will be a blob and a filename cannot be
  // derrived from it. We need a filename to be able to derrive the correct
  // file loader, which relies on the file extension. Blobs do not have
  // filenames with extensions, and that's a security feature. They looks like:
  // blob:http://localhost:3000/9f19dc8a-02fd-4554-99a0-8ee40151b4a1
  function load({node, url, filename}) {
    const {loader, buildSceneNode} = loaderManager.getLoader(filename);

    if (!cache[filename]) {
      cache[filename] = loader.load(url);
    }

    return cache[filename].then(data => {
      buildSceneNode(gl, data, node, sceneManager);
    });
  }

  return {
    loadMany,
    load,
  }
}

export function getResourcesFromConfig(config) {
  const traverse = treeGetMatches((item) => (
    (isStaticMesh(item) || isLight(item)) &&
    (!!item.resource && typeof item.resource === "string")
  ));

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

class LoaderManager {
  constructor() {
    this.loaders = {};
  }

  register(fileExtension, loader) {
    if (this.loaders.hasOwnProperty(fileExtension)) {
      throw new Error(`Loader for file extension "${fileExtension}" is already regitered.`);
    }

    this.loaders[fileExtension] = loader;
    return this;
  }

  getLoader(filename) {
    const match = filename.match(/(?:\.(\w+))$/);

    if (!match) {
      throw new Error("File didn't have an extension");
    }

    const [, fileExtension] = match;

    if (!this.loaders.hasOwnProperty(fileExtension)) {
      throw new Error(`Loader for file extension "${fileExtension}" not registered`);
    }

    return this.loaders[fileExtension];
  }
}
