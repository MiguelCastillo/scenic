import {range} from "./range.js";
import {fixed5f} from "./float.js";

describe("range", () => {
  it("0 to 10 with default step of 1", () => {
    expect(range(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("0 to 5 with .5 step", () => {
    expect(range(0, 5, 0.5)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });

  it("0 to 10000 with 1000 step", () => {
    expect(range(0, 10000, 1000)).toEqual([
      0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
    ]);
  });

  it("-5 to 5 with default step of 1", () => {
    expect(range(-5, 5)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
  });

  it("0 to 0.9 with step of 0.1", () => {
    expect(range(0, 0.9, 0.1).map(fixed5f)).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ]);
  });

  it("1 to 1.9 with step of 0.1", () => {
    expect(range(1, 1.9, 0.1).map(fixed5f)).toEqual([
      1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
    ]);
  });
});
