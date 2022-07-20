import {lerp} from "./lerp.js";
import {range} from "./range.js";

describe("lerp", () => {
  it("range 0 to 10", () => {
    expect(range(0, 10).map((i) => lerp(i / 10, 0, 10))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});
