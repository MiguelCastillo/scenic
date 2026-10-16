import {buildPerspectiveProjection} from "./projections.js";

// clip applies a column-major projection to a point in front of a camera
// looking down -Z.
function clip(projection, [x, y, z]) {
  return [0, 1, 2, 3].map(
    (row) =>
      projection[row] * x + projection[4 + row] * y + projection[8 + row] * z + projection[12 + row]
  );
}

describe("buildPerspectiveProjection", () => {
  const projection = buildPerspectiveProjection(90, 100, 100, 1, 1000);

  test("puts near at the front of clip space and far at the back", () => {
    const [, , nearZ, nearW] = clip(projection, [0, 0, -1]);
    const [, , farZ, farW] = clip(projection, [0, 0, -1000]);
    expect(nearZ / nearW).toBeCloseTo(-1, 5);
    expect(farZ / farW).toBeCloseTo(1, 5);
  });

  test("makes w the distance in front of the camera", () => {
    const [, , , w] = clip(projection, [0, 0, -250]);
    expect(w).toBeCloseTo(250, 5);
  });

  test("puts the edge of a 90 degree view at the edge of clip space", () => {
    // 45 degrees to the right, 100 away.
    const [x, , , w] = clip(projection, [100, 0, -100]);
    expect(x / w).toBeCloseTo(1, 5);
  });
});
