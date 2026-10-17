// A bounding volume is a simple shape around a mesh's vertices, used to tell
// quickly whether the mesh can be in view without looking at its vertices.
//
// - It is measured once, from the vertices, when the geometry is built (see
//   Geometry and Renderable), in the mesh's own space. Vertices don't
//   change after that, so neither does the volume.
// - Each frame, it is only placed where the mesh is, with the mesh's world
//   matrix, and checked against the camera's view (see
//   canSeeBoundingVolume in Viewport). Moving the mesh moves its volume
//   with it, with nothing measured again.
//
// Whoever uses a bounding volume only asks it isOutsideView, so it can be
// any shape: a box today, and a sphere or anything else could answer the
// same question.

// BoundingBox is a bounding volume shaped like a box: min and max are the
// lowest and highest x, y and z of what it bounds, in its own space. Placed
// with a matrix, it turns and stretches with it, so it fits long, thin
// meshes, such as a gantry's bar, much more closely than a sphere would.
export class BoundingBox {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }

  // around is the box around positions, a flat list of x, y and z.
  static around(positions) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], positions[i + k]);
        max[k] = Math.max(max[k], positions[i + k]);
      }
    }
    return new BoundingBox(min, max);
  }

  // enclosing is the box around both this box and other, or this box for
  // no other.
  enclosing(other) {
    if (!other) {
      return this;
    }
    return new BoundingBox(
      this.min.map((v, k) => Math.min(v, other.min[k])),
      this.max.map((v, k) => Math.max(v, other.max[k]))
    );
  }

  // isOutsideView is whether the box, placed with matrix, is wholly outside
  // the view bounded by planes, the sides of what a camera sees (see
  // frustumPlanes in Viewport). A box only partly in view is not outside
  // it, so it is drawn.
  //
  // Each plane is [a, b, c, d], with (a, b, c) a unit normal facing into
  // the view, so that for a point (x, y, z), a x + b y + c z + d is how far
  // the point is inside that side, or outside it when negative. The box is
  // outside the view when it is wholly outside any one side; it doesn't
  // have to be outside them all.
  //
  // This can say a box is in view when it isn't, such as one just past a
  // corner of the view, outside two sides at once but not wholly outside
  // either. That only draws a mesh that wasn't needed. It never says a box
  // that is in view is outside it.
  //
  // Performance: this runs for every mesh, and every copy of one, such as
  // each tree of a forest, every frame. It must not allocate: it works with
  // plain numbers, and reads arrays by index, with no new arrays, objects or
  // closures, which would each be garbage to collect. See "Best practices
  // for the hot path" in the README.
  isOutsideView(planes, matrix) {
    // The middle of the box, and half its size along each of its own axes.
    const {min, max} = this;
    const mx = (min[0] + max[0]) / 2;
    const my = (min[1] + max[1]) / 2;
    const mz = (min[2] + max[2]) / 2;
    const hx = (max[0] - min[0]) / 2;
    const hy = (max[1] - min[1]) / 2;
    const hz = (max[2] - min[2]) / 2;

    // Where the matrix puts the middle: the box's center in the world.
    // Matrix4 data is row-major, so the matrix's columns are the box's own
    // x, y and z axes in the world.
    const m = matrix.data;
    const x = m[0] * mx + m[1] * my + m[2] * mz + m[3];
    const y = m[4] * mx + m[5] * my + m[6] * mz + m[7];
    const z = m[8] * mx + m[9] * my + m[10] * mz + m[11];

    // For each side: distance is how far the box's center is inside it,
    // and reach is how far the box spreads from its center toward it: each
    // of its half-sizes, along its axis in the world, measured along the
    // side's normal. The box is wholly outside the side when its center is
    // farther outside than that reach.
    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      const a = plane[0];
      const b = plane[1];
      const c = plane[2];
      const d = plane[3];
      const distance = a * x + b * y + c * z + d;
      const reach =
        Math.abs(a * m[0] + b * m[4] + c * m[8]) * hx +
        Math.abs(a * m[1] + b * m[5] + c * m[9]) * hy +
        Math.abs(a * m[2] + b * m[6] + c * m[10]) * hz;
      if (distance < -reach) {
        return true;
      }
    }
    return false;
  }
}

// boundingSphere is a sphere around positions, a flat list of x, y and z: its
// center is the middle of their bounding box, and its radius reaches the
// farthest of them.
export function boundingSphere(positions) {
  const {min, max} = BoundingBox.around(positions);
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
