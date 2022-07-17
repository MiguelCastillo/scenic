import {treeGetMatches} from "../../packages/scene/traversal.js";

import {Loader as ObjFileLoader, buildSceneNode as objBuildSceneNode} from "./obj/loader.js";

import {Loader as FbxFileLoader, buildSceneNode as fbxBuildSceneNode} from "./fbx/loader.js";

import {isLight, isStaticMesh, isSkinnedMesh} from "../scene-factory.js";

export function createResourceLoader(gl, sceneManager) {
  const cache = {};

  // File loader mappings to file extension.
  const loaderManager = new LoaderManager()
    .register("obj", {
      loader: new ObjFileLoader(),
      buildSceneNode: objBuildSceneNode,
    })
    .register("fbx", {
      loader: new FbxFileLoader(),
      buildSceneNode: fbxBuildSceneNode,
    });

  function loadMany(resources) {
    return Promise.all(resources.map((resource) => this.load(resource)));
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

    return cache[filename].then((data) => {
      const sceneNode = sceneManager.getNodeByID(node.id);
      if (!sceneNode) {
        throw new Error(`unable to load resource. scene node with "${node.id}" was not found.`);
      }
      buildSceneNode(gl, data, sceneNode, sceneManager);
    });
  }

  return {
    loadMany,
    load,
  };
}

export function getResourcesFromConfig(config) {
  // TODO(miguel): do we really need to filter out by node type?
  const traverse = treeGetMatches(
    (item) =>
      (isStaticMesh(item) || isSkinnedMesh(item) || isLight(item)) &&
      !!item.resource &&
      typeof item.resource === "string"
  );

  return traverse(config.items).map((item) => {
    return {
      node: item,
      url: item.resource,
      filename: item.resource.split(/[\/]/).pop(),
    };
  });
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
