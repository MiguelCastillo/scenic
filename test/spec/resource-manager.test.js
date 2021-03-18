import {ResourceManager} from "../../src/resource-manager.js";

test("registering file extension loader", () => {
  const resourceManager = new ResourceManager();
  const loader = () => {};
  resourceManager.register("obj", loader);

  expect(resourceManager.loaders).toEqual(
    expect.objectContaining({
    "obj": loader,
  }));
});

test("registering loader for already registered file extension throws an error", () => {
  const resourceManager = new ResourceManager();
  resourceManager.register("obj", () => {});

  // Registering for the same file exension will throw an error.
  expect(() => {
    resourceManager.register("obj", () => {});
  }).toThrow();
});

test("file extension loader is called", () => {
  const resourceManager = new ResourceManager();
  const objMockCallback = jest.fn(x => Promise.resolve());
  const notObjMockCallback = jest.fn(x => Promise.resolve());

  resourceManager.register("obj", objMockCallback);
  resourceManager.register("part1", notObjMockCallback);
  resourceManager.load("file.part1.obj");

  expect(objMockCallback).toBeCalledWith("file.part1.obj");
  expect(notObjMockCallback).not.toHaveBeenCalled();
});

test("loading file with unregistered extension throws error", () => {
  const resourceManager = new ResourceManager();

  expect(() => {
    resourceManager.load("file.part1.obj");
  }).toThrowError("Loader for file extension \"obj\" not registered");
});

test("loading file with no extension throws error", () => {
  const resourceManager = new ResourceManager();

  expect(() => {
    resourceManager.load("file-no-extension");
  }).toThrowError("File didn't have an extension");
});
