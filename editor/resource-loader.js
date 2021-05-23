import * as vec3 from "../src/math/vector3.js";
import {
  VertexBuffer,
  VertexBufferData,
} from "../src/renderer/vertexbuffer.js";

import {treeGetMatches} from "../src/scene/traversal.js";
import {ResourceManager} from "../src/resource-manager.js";

import {ObjLoader} from "./file-loaders.js";
import {isLight, isStaticMesh} from "./scene-factory.js";

function buildVertexBuffer(gl, model) {
  let {vertices, normals, colors} = model;

  const vertexBuffer = VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
  });

  if (!normals.byteLength && !normals.length) {
    vertexBuffer.withNormals(
      new VertexBufferData(
        gl, vec3.normalizeTriangleVertices(new Float32Array(vertices))));
  }
  else {
    vertexBuffer.withNormals(new VertexBufferData(gl, normals));
  }

  if (colors.byteLength || colors.length) {
    vertexBuffer.withColors(new VertexBufferData(gl, colors));
  }

  return vertexBuffer;
}

export function createResourceLoader(gl, sceneManager) {
  const cache = {};

  const objLoader = new ObjLoader();
  const resourceManager = new ResourceManager()
    .register("obj", (file) => objLoader.load(file));

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
    if (!cache[filename]) {
      cache[filename] = resourceManager
        .load(url, filename)
        // For now I am assuming that all resources are for object files.
        // But that's clearly going to be changing to support other types
        // of resources. For example, some resources will be for files that
        // support animation. In those cases we will need a different handler
        // here.  But for now, let's keep it simple and we will expand as the
        // need comes up.
        .then(model => buildVertexBuffer(gl, model));
    }

    return cache[filename].then(vbuffer => {
      sceneManager
        .getNodeByName(node.name)
        .withVertexBuffer(vbuffer);
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
