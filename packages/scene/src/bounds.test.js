import {boundingBox, boundingSphere, encloseBoxes} from "./bounds.js";
import {Geometry} from "./geometry.js";
import {Mesh} from "./mesh.js";

// geometry is a Geometry whose buffer has positions, a flat list of x, y
// and z.
const geometry = (name, positions) =>
  new Geometry({name, id: name}, {positions: {data: new Float32Array(positions)}});

describe("boundingBox", () => {
  test("is the lowest and highest of each of x, y and z", () => {
    expect(boundingBox([0, 0, 0, 10, -2, 1, 3, 4, -5])).toEqual({
      min: [0, -2, -5],
      max: [10, 4, 1],
    });
  });
});

describe("encloseBoxes", () => {
  test("is the box around both", () => {
    const a = {min: [0, 0, 0], max: [1, 1, 1]};
    const b = {min: [-1, 0.5, 0], max: [0.5, 3, 1]};
    expect(encloseBoxes(a, b)).toEqual({min: [-1, 0, 0], max: [1, 3, 1]});
  });

  test("is one when the other is nothing", () => {
    const a = {min: [0, 0, 0], max: [1, 1, 1]};
    expect(encloseBoxes(a, null)).toBe(a);
    expect(encloseBoxes(null, a)).toBe(a);
    expect(encloseBoxes(null, null)).toBe(null);
  });
});

describe("boundingSphere", () => {
  test("is around every position", () => {
    const {center, radius} = boundingSphere([0, 0, 0, 10, 0, 0, 0, 4, 0]);
    expect(center).toEqual([5, 2, 0]);
    expect(radius).toBeCloseTo(Math.hypot(5, 2));
  });
});

describe("a geometry's box", () => {
  test("is measured when it is built", () => {
    expect(geometry("wing", [-5, 0, 0, 5, 1, 2]).localBox).toEqual({
      min: [-5, 0, 0],
      max: [5, 1, 2],
    });
  });

  test("is nothing for a buffer without positions", () => {
    expect(new Geometry({name: "lines", id: "lines"}, {}).localBox).toBe(null);
  });
});

describe("a renderable's box", () => {
  test("is around its geometries, as they are added and removed", () => {
    const mesh = new Mesh({type: "static-mesh", name: "ship", id: "ship"});
    const near = geometry("ship near", [-5, 0, 0, 5, 1, 1]);
    const far = geometry("ship far", [-6, 0, 0, 4, 2, 1]);

    expect(mesh.localBox).toBe(null);
    mesh.add(near).add(far);
    expect(mesh.localBox).toEqual({min: [-6, 0, 0], max: [5, 2, 1]});
    mesh.remove(far);
    expect(mesh.localBox).toEqual({min: [-5, 0, 0], max: [5, 1, 1]});
  });

  test("leaves out a renderable under it, which keeps its own", () => {
    const ship = new Mesh({type: "static-mesh", name: "hull", id: "hull"});
    const flame = new Mesh({type: "static-mesh", name: "flame", id: "flame"});
    flame.add(geometry("flame shape", [0, 0, 0, 1, 1, 1]));
    ship.add(geometry("hull shape", [-1, -1, -1, 1, 1, 1])).add(flame);

    expect(ship.localBox).toEqual({min: [-1, -1, -1], max: [1, 1, 1]});
    expect(flame.localBox).toEqual({min: [0, 0, 0], max: [1, 1, 1]});
  });
});
