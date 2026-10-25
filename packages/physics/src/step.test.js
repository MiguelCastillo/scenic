import {step} from "./step.js";

const gravity = [0, -10, 0];

describe("step", () => {
  test("falls freely without drag", () => {
    const {velocity, offset} = step({mass: 1, velocity: [0, 0, 0]}, {gravity}, 2);
    expect(velocity[1]).toBeCloseTo(-20);
    expect(offset[1]).toBeCloseTo(-20);
  });

  test("settles at its terminal velocity with drag", () => {
    const {velocity} = step({mass: 1, velocity: [0, 0, 0]}, {gravity, drag: 2}, 10);
    expect(velocity[1]).toBeCloseTo(-5);
  });

  test("a heavier body falls faster against the same drag", () => {
    const light = step({mass: 1, velocity: [0, 0, 0]}, {gravity, drag: 2}, 10);
    const heavy = step({mass: 2, velocity: [0, 0, 0]}, {gravity, drag: 2}, 10);
    expect(heavy.velocity[1]).toBeCloseTo(-10);
    expect(heavy.velocity[1]).toBeLessThan(light.velocity[1]);
  });

  test("a force against gravity climbs", () => {
    const {velocity} = step(
      {mass: 1, velocity: [0, 0, 0]},
      {gravity, force: [0, 30, 0], drag: 2},
      10
    );
    expect(velocity[1]).toBeCloseTo(10);
  });

  test("moves the same at any frame rate", () => {
    let body = {mass: 1, velocity: [0, 50, 0]};
    let height = 0;
    for (let frame = 0; frame < 120; frame++) {
      const {velocity, offset} = step(body, {gravity, drag: 2}, 1 / 120);
      body = {...body, velocity};
      height += offset[1];
    }
    const once = step({mass: 1, velocity: [0, 50, 0]}, {gravity, drag: 2}, 1);
    expect(body.velocity[1]).toBeCloseTo(once.velocity[1], 6);
    expect(height).toBeCloseTo(once.offset[1], 6);
  });
});
