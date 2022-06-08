import {wrapTime} from "./wrap-time.js";
import {range} from "../math/range.js";
import {fixed5f} from "../math/float.js";

describe("wrapRtime with duration of 5 at different speeds", () => {
  it("speed 1", () => {
    const speed = 1;
    const duration = 5;

    expect(
      range(0, 0.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);

    expect(
      range(1, 1.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]);

    expect(
      range(2, 2.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9]);

    expect(
      range(3, 3.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9]);

    expect(
      range(4, 4.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9]);

    expect(
      range(5, 5.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([5, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);

    expect(
      range(6, 6.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]);
  });

  it("speed 1.25", () => {
    const speed = 1.25;
    const duration = 5;

    expect(
      range(0, 0.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125]);

    expect(
      range(1, 1.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2, 2.125, 2.25, 2.375]);

    expect(
      range(2, 2.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2.5, 2.625, 2.75, 2.875, 3, 3.125, 3.25, 3.375, 3.5, 3.625]);

    expect(
      range(3, 3.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3.75, 3.875, 4, 4.125, 4.25, 4.375, 4.5, 4.625, 4.75, 4.875]);

    expect(
      range(4, 4.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([5, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125]);

    expect(
      range(5, 5.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2, 2.125, 2.25, 2.375]);

    expect(
      range(6, 6.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2.5, 2.625, 2.75, 2.875, 3, 3.125, 3.25, 3.375, 3.5, 3.625]);

    expect(
      range(7, 7.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3.75, 3.875, 4, 4.125, 4.25, 4.375, 4.5, 4.625, 4.75, 4.875]);

    expect(
      range(8, 8.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([5, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125]);

    expect(
      range(9, 9.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2, 2.125, 2.25, 2.375]);

    expect(
      range(10, 10.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2.5, 2.625, 2.75, 2.875, 3, 3.125, 3.25, 3.375, 3.5, 3.625]);

    expect(
      range(11, 11.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3.75, 3.875, 4, 4.125, 4.25, 4.375, 4.5, 4.625, 4.75, 4.875]);
  });

  it("speed 1.5", () => {
    const speed = 1.5;
    const duration = 5;

    expect(
      range(0, 0.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35]);

    expect(
      range(1, 1.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4, 2.55, 2.7, 2.85]);

    expect(
      range(2, 2.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3, 3.15, 3.3, 3.45, 3.6, 3.75, 3.9, 4.05, 4.2, 4.35]);

    expect(
      range(3, 3.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([4.5, 4.65, 4.8, 4.95, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85]);

    expect(
      range(4, 4.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2, 2.35]);

    expect(
      range(5, 5.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2.5, 2.65, 2.8, 2.95, 3.1, 3.25, 3.4, 3.55, 3.7, 3.85]);

    expect(
      range(6, 6.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([4, 4.15, 4.3, 4.45, 4.6, 4.75, 4.9, 0.05, 0.2, 0.35]);

    expect(
      range(7, 7.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.55, 1.7, 1.85]);

    expect(
      range(8, 8.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([2, 2.15, 2.3, 2.45, 2.6, 2.75, 2.9, 3.05, 3.2, 3.35]);

    expect(
      range(9, 9.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([3.5, 3.65, 3.8, 3.95, 4.1, 4.25, 4.4, 4.55, 4.7, 4.85]);

    expect(
      range(10, 10.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([5, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35]);

    expect(
      range(11, 11.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4, 2.55, 2.7, 2.85]);

    expect(
      range(11000, 11000.9, 0.1)
        .map((v) => wrapTime(v, duration, speed))
        .map(fixed5f)
    ).toEqual([5, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35]);
  });

  it("with varying speed between -0.5 and 0.5", () => {
    expect(
      range(-0.5, 0.5, 0.05)
        .map((s) => wrapTime(500, 10000, s))
        .map(fixed5f)
    ).toEqual([
      -250, -225, -200, -175, -150, -125, -100, -75, -50, -25, 0, 25, 50, 75, 100, 125, 150, 175,
      200, 225, 250,
    ]);
  });
});
