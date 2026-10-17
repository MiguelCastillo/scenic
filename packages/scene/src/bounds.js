// Bounds are measured once, when what they bound is built, so that drawing
// never has to: a box, {min, max}, the lowest and highest x, y and z of a
// geometry's positions, in its own space, which the view places with the
// mesh's world matrix to see whether it can be in view.

// boundingBox is the box around positions, a flat list of x, y and z: the
// lowest and the highest of each.
export function boundingBox(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return {min, max};
}

// encloseBoxes is the box around both a and b, either of which can be null,
// for nothing.
export function encloseBoxes(a, b) {
  if (!a || !b) {
    return a || b || null;
  }
  return {
    min: a.min.map((v, k) => Math.min(v, b.min[k])),
    max: a.max.map((v, k) => Math.max(v, b.max[k])),
  };
}

// boundingSphere is a sphere around positions, a flat list of x, y and z: its
// center is the middle of their bounding box, and its radius reaches the
// farthest of them.
export function boundingSphere(positions) {
  const {min, max} = boundingBox(positions);
  const center = min.map((v, k) => (v + max[k]) / 2);
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(
      radius,
      Math.hypot(
        positions[i] - center[0],
        positions[i + 1] - center[1],
        positions[i + 2] - center[2]
      )
    );
  }
  return {center, radius};
}
