import {mat4} from "@scenic/math";

import {collide, worldCollider} from "./collision.js";

const place = (collider, position, scale = [1, 1, 1]) =>
  worldCollider(collider, mat4.Matrix4.trs(position, [0, 0, 0], scale));

const sphere = (position, radius) => place({shape: "sphere", radius}, position);

describe("collide", () => {
  it("finds spheres that overlap", () => {
    const contact = collide(sphere([0, 0, 0], 1), sphere([1.5, 0, 0], 1));
    expect(contact.normal).toEqual([-1, 0, 0]);
    expect(contact.depth).toBeCloseTo(0.5);
  });

  it("finds no contact between spheres apart", () => {
    expect(collide(sphere([0, 0, 0], 1), sphere([3, 0, 0], 1))).toBeNull();
  });

  describe("cylinder", () => {
    // A column 20 wide and 100 tall, from y = 0 to 100, like a unit
    // cylinder mesh scaled by [10, 50, 10] and raised by 50.
    const column = place({shape: "cylinder"}, [0, 50, 0], [10, 50, 10]);

    it("pushes a sphere touching its wall straight out", () => {
      const contact = collide(sphere([14, 30, 0], 5), column);
      expect(contact.normal[0]).toBeCloseTo(1);
      expect(contact.normal[1]).toBeCloseTo(0);
      expect(contact.depth).toBeCloseTo(1);
    });

    it("pushes a sphere touching its top up", () => {
      const contact = collide(sphere([0, 103, 0], 5), column);
      expect(contact.normal[1]).toBeCloseTo(1);
      expect(contact.depth).toBeCloseTo(2);
    });

    it("pushes a sphere whose center is inside out of the nearest side", () => {
      const contact = collide(sphere([8, 50, 0], 5), column);
      expect(contact.normal[0]).toBeCloseTo(1);
      expect(contact.depth).toBeCloseTo(7);
    });

    it("finds no contact past its top", () => {
      expect(collide(sphere([0, 110, 0], 5), column)).toBeNull();
    });
  });

  describe("cone", () => {
    // A cone 20 wide at its base, at y = 0, to a point at y = 100.
    const cone = place({shape: "cone"}, [0, 50, 0], [10, 50, 10]);

    it("collides near its base", () => {
      expect(collide(sphere([12, 1, 0], 5), cone)).not.toBeNull();
    });

    it("lets a sphere pass beside its narrow top", () => {
      expect(collide(sphere([8, 90, 0], 5), cone)).toBeNull();
    });

    it("collides at its point", () => {
      const contact = collide(sphere([0, 103, 0], 5), cone);
      expect(contact.normal[1]).toBeCloseTo(1);
    });
  });
});
