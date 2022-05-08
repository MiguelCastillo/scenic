import {range} from "./range.js";

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
});
