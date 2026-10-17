import {mat4} from "@scenic/math";

import {BoundingBox, boundingSphere} from "./bounds.js";
import {Geometry} from "./geometry.js";
import {Mesh} from "./mesh.js";

// geometry is a Geometry whose buffer has positions, a flat list of x, y
// and z.
const geometry = (name, positions) =>
  new Geometry({name, id: name}, {positions: {data: new Float32Array(positions)}});

const box = (min, max) => new BoundingBox(min, max);

describe("BoundingBox", () => {
  test("around positions is the lowest and highest of each of x, y and z", () => {
    expect(BoundingBox.around([0, 0, 0, 10, -2, 1, 3, 4, -5])).toEqual(
      box([0, -2, -5], [10, 4, 1])
    );
  });

  test("enclosing another is the box around both", () => {
    expect(box([0, 0, 0], [1, 1, 1]).enclosing(box([-1, 0.5, 0], [0.5, 3, 1]))).toEqual(
      box([-1, 0, 0], [1, 3, 1])
    );
  });

  test("enclosing nothing is itself", () => {
    const a = box([0, 0, 0], [1, 1, 1]);
    expect(a.enclosing(null)).toBe(a);
  });

  describe("isOutsideView", () => {
    // A view bounded by the plane x = 0, facing +X: inside is x >= 0.
    const planes = [[1, 0, 0, 0]];
    const at = (x, angle = 0) => mat4.Matrix4.trs([x, 0, 0], [0, 0, angle], [1, 1, 1]);
    // A bar from -10 to 10 along its X, 2 thick.
    const bar = box([-10, -1, -1], [10, 1, 1]);

    test("is false while any of it is inside", () => {
      expect(bar.isOutsideView(planes, at(5))).toBe(false);
      expect(bar.isOutsideView(planes, at(-9))).toBe(false);
    });

    test("is true when all of it is outside", () => {
      expect(bar.isOutsideView(planes, at(-11))).toBe(true);
    });

    test("turns with its matrix", () => {
      // Turned to stand along Y, it is only 1 wide along X.
      expect(bar.isOutsideView(planes, at(-5, 90))).toBe(true);
      expect(bar.isOutsideView(planes, at(-0.5, 90))).toBe(false);
    });
  });
});

describe("boundingSphere", () => {
  test("is around every position", () => {
    const {center, radius} = boundingSphere([0, 0, 0, 10, 0, 0, 0, 4, 0]);
    expect(center).toEqual([5, 2, 0]);
    expect(radius).toBeCloseTo(Math.hypot(5, 2));
  });
});

describe("a geometry's bounding volume", () => {
  test("is measured when it is built", () => {
    expect(geometry("wing", [-5, 0, 0, 5, 1, 2]).boundingVolume).toEqual(
      box([-5, 0, 0], [5, 1, 2])
    );
  });

  test("is nothing for a buffer without positions", () => {
    expect(new Geometry({name: "lines", id: "lines"}, {}).boundingVolume).toBe(null);
  });
});

describe("a renderable's bounding volume", () => {
  test("is around its geometries, as they are added and removed", () => {
    const mesh = new Mesh({type: "static-mesh", name: "ship", id: "ship"});
    const near = geometry("ship near", [-5, 0, 0, 5, 1, 1]);
    const far = geometry("ship far", [-6, 0, 0, 4, 2, 1]);

    expect(mesh.boundingVolume).toBe(null);
    mesh.add(near).add(far);
    expect(mesh.boundingVolume).toEqual(box([-6, 0, 0], [5, 2, 1]));
    mesh.remove(far);
    expect(mesh.boundingVolume).toEqual(box([-5, 0, 0], [5, 1, 1]));
  });

  test("leaves out a renderable under it, which keeps its own", () => {
    const ship = new Mesh({type: "static-mesh", name: "hull", id: "hull"});
    const flame = new Mesh({type: "static-mesh", name: "flame", id: "flame"});
    flame.add(geometry("flame shape", [0, 0, 0, 1, 1, 1]));
    ship.add(geometry("hull shape", [-1, -1, -1, 1, 1, 1])).add(flame);

    expect(ship.boundingVolume).toEqual(box([-1, -1, -1], [1, 1, 1]));
    expect(flame.boundingVolume).toEqual(box([0, 0, 0], [1, 1, 1]));
  });
});
