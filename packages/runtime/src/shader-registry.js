import {ShaderRegistry} from "@scenic/renderer";
import {Node, Renderable, Mesh, Light, Geometry, Texture} from "@scenic/scene";

import {createShaderProgramAsync} from "./shader-factory.js";

// shaderRegistry is the runtime's ShaderRegistry (see @scenic/renderer). It is
// the only place shader programs are created. Code that defines a renderable
// registers its shader on it next to the renderable, and shader files are
// loaded from the runtime's shaders directory the first time they are needed
// (see shader-factory.js).
export const shaderRegistry = new ShaderRegistry(createShaderProgramAsync);

// applyShaders gives every renderable in root's subtree, root included, that
// has no shader program the one the registry picks for it. Call it once nodes
// are built, such as after a model is loaded, since what a node draws can
// decide its shader. isDisposed reports whether the scene was disposed while
// shaders loaded.
//
// Finding renderables uses @scenic/scene's classes, which is why this lives in
// the runtime rather than in @scenic/renderer: a package bundles its own copy
// of its dependencies, so a copy of Renderable inside @scenic/renderer would
// not match the runtime's nodes.
export function applyShaders(gl, root, isDisposed) {
  const renderables = Node.findChildrenByType(root, Renderable);
  if (root instanceof Renderable) {
    renderables.unshift(root);
  }
  return shaderRegistry.applyShaders(gl, renderables, isDisposed);
}

// Meshes and lights draw the geometry under them. A model's config node, such
// as the node an FBX file is loaded into, has no geometry of its own because
// the model's meshes do the drawing, so it needs no shader program. A mesh
// with a texture of its own, a Texture child, such as the one a static
// mesh's state names, draws with phong-texture, where the texture tints its
// colors (see textures on a static mesh in the README).
const hasGeometry = (node) => node.items.some((child) => child instanceof Geometry);
const hasTexture = (node) => node.items.some((child) => child instanceof Texture);

const meshShader = (mesh) => {
  if (!hasGeometry(mesh)) {
    return null;
  }
  return hasTexture(mesh) ? "shaders/phong-texture" : "shaders/phong-lighting";
};

shaderRegistry
  .register(Mesh, meshShader)
  .register(Light, (light) => (hasGeometry(light) ? "shaders/flat-material" : null));
