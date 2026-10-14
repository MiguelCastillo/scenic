import {ShaderRegistry} from "./shader-registry.js";

class Shape {
  constructor() {
    this.shaderProgram = null;
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram;
    return this;
  }
}
class Box extends Shape {}
class Crate extends Box {}
class Line extends Shape {}

// createRegistry returns a registry whose programs record their shader name
// and whether they were disposed.
function createRegistry() {
  const created = [];
  const registry = new ShaderRegistry(async (gl, name) => {
    const program = {name, disposed: false, dispose: () => (program.disposed = true)};
    created.push(program);
    return program;
  });
  return {registry, created};
}

describe("ShaderRegistry.shaderFor", () => {
  test("uses the registration of the object's class", () => {
    const {registry} = createRegistry();
    registry.register(Box, "box-shader");

    expect(registry.shaderFor(new Box())).toBe("box-shader");
  });

  test("uses a parent class's registration when the class has none", () => {
    const {registry} = createRegistry();
    registry.register(Box, "box-shader");

    expect(registry.shaderFor(new Crate())).toBe("box-shader");
  });

  test("prefers the most specific class's registration", () => {
    const {registry} = createRegistry();
    registry.register(Shape, "shape-shader").register(Crate, "crate-shader");

    expect(registry.shaderFor(new Crate())).toBe("crate-shader");
    expect(registry.shaderFor(new Line())).toBe("shape-shader");
  });

  test("calls a registered function to pick the shader for the object", () => {
    const {registry} = createRegistry();
    registry.register(Box, (box) => (box.textured ? "textured" : "plain"));
    const textured = Object.assign(new Box(), {textured: true});

    expect(registry.shaderFor(textured)).toBe("textured");
    expect(registry.shaderFor(new Box())).toBe("plain");
  });

  test("is null for an object with no registration", () => {
    const {registry} = createRegistry();

    expect(registry.shaderFor(new Line())).toBeNull();
  });
});

describe("ShaderRegistry.applyShaders", () => {
  test("gives each object without a program the one its registration picks", async () => {
    const {registry} = createRegistry();
    registry.register(Box, "box-shader").register(Line, (line) => (line.visible ? "line" : null));
    const box = new Box();
    const hiddenLine = new Line();

    await registry.applyShaders(null, [box, hiddenLine], () => false);

    expect(box.shaderProgram.name).toBe("box-shader");
    expect(hiddenLine.shaderProgram).toBeNull();
  });

  test("leaves objects that already have a program alone", async () => {
    const {registry, created} = createRegistry();
    registry.register(Box, "box-shader");
    const existing = {name: "existing"};
    const box = new Box().withShaderProgram(existing);

    await registry.applyShaders(null, [box], () => false);

    expect(box.shaderProgram).toBe(existing);
    expect(created).toHaveLength(0);
  });

  test("deletes the program when the objects were disposed while it loaded", async () => {
    const {registry, created} = createRegistry();
    registry.register(Box, "box-shader");
    const box = new Box();

    await registry.applyShaders(null, [box], () => true);

    expect(box.shaderProgram).toBeNull();
    expect(created[0].disposed).toBe(true);
  });
});
