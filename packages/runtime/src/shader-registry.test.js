import {Geometry, StaticMesh, Texture} from "@scenic/scene";

import {shaderRegistry} from "./shader-registry.js";

describe("the runtime's shader for a mesh", () => {
  // meshWith is a static mesh with the children given.
  const meshWith = (...children) => {
    const mesh = new StaticMesh({name: "mesh"});
    children.forEach((child) => mesh.add(child));
    return mesh;
  };
  const geometry = () => new Geometry({name: "geometry"}, {positions: {data: new Float32Array(9)}});

  test("is none without geometry", () => {
    expect(shaderRegistry.shaderFor(meshWith())).toBe(null);
  });

  test("lights its colors with geometry", () => {
    expect(shaderRegistry.shaderFor(meshWith(geometry()))).toBe("shaders/phong-lighting");
  });

  test("tints its colors with a texture of its own", () => {
    const texture = new Texture(0, "diffusecolor", {name: "bark"});
    expect(shaderRegistry.shaderFor(meshWith(geometry(), texture))).toBe("shaders/phong-texture");
  });
});
