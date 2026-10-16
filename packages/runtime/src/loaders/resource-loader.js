import {traversal} from "@scenic/scene";
import {Loader as ObjFileLoader, buildSceneNode as objBuildSceneNode} from "./obj/loader.js";
import {Loader as FbxFileLoader, buildSceneNode as fbxBuildSceneNode} from "./fbx/loader.js";
import {applyShaders} from "../shader-registry.js";
import {isLight, isStaticMesh, isSkinnedMesh} from "../scene-factory.js";

export function createResourceLoader(gl, sceneManager) {
  const cache = {};
  let disposed = false;

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
  function load({node, url, filename, lodDistance}) {
    const {loader, buildSceneNode} = loaderManager.getLoader(filename);

    if (!cache[filename]) {
      cache[filename] = loader.load(url);
    }

    return cache[filename].then((data) => {
      // A load can finish after the scene was disposed, for example when
      // another resource failed to load. Building it now would create GPU
      // resources that nothing will ever delete.
      if (disposed) {
        return;
      }

      const sceneNode = sceneManager.getNodeByID(node.id);
      if (!sceneNode) {
        throw new Error(`unable to load resource. scene node with "${node.id}" was not found.`);
      }
      buildSceneNode(gl, data, sceneNode, sceneManager, lodDistance);

      // Now that the node is built, give its renderables the shader programs
      // they draw with.
      return applyShaders(gl, sceneNode, () => disposed);
    });
  }

  return {
    loadMany,
    load,
    dispose: () => {
      disposed = true;
      loaderManager.dispose();
    },
  };
}

export function getResourcesFromConfig(config) {
  // TODO(miguel): do we really need to filter out by node type?
  const traverse = traversal.treeGetMatches(
    (item) =>
      (isStaticMesh(item) || isSkinnedMesh(item) || isLight(item)) &&
      !!item.resource &&
      typeof item.resource === "string"
  );

  // A static mesh's lods are simpler versions of its resource for far away,
  // each loaded into the mesh too, with the distance it takes over from (see
  // Mesh.render in @scenic/scene).
  const filename = (resource) => resource.split(/[\/]/).pop();
  return traverse(config.items).flatMap((item) => [
    {node: item, url: item.resource, filename: filename(item.resource)},
    ...(item.lods || []).map(({resource, distance}) => ({
      node: item,
      url: resource,
      filename: filename(resource),
      lodDistance: distance,
    })),
  ]);
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

  dispose() {
    Object.values(this.loaders).forEach(({loader}) => loader.dispose());
  }
}
