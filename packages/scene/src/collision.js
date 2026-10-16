import {Node} from "./node.js";

// Collision finds where shapes in the scene touch, so that things can bump
// into each other rather than fly through.
//
// A node takes part when its state has a "collider", a simple shape around
// it in the node's own space, which its world matrix places in the world:
// - {"shape": "sphere", "radius": r}: a ball around the node's origin. A
//   good fit for things that move, such as a rocket.
// - {"shape": "cylinder", "radius": r, "height": h}: an upright cylinder
//   around the node's Y axis, centered on its origin.
// - {"shape": "cone", "radius": r, "height": h}: like a cylinder, but
//   narrowing to a point at its top.
// radius and height are optional, and default to the size of the unit
// cylinder and cone meshes, a radius of 1 and a height of 2, so a column
// built from those meshes only needs its shape. Scaled nodes scale their
// colliders, but a sphere stays round, using its node's largest scale.
//
// Only spheres are tested against other shapes, so at least one of any two
// shapes that should collide is a sphere. Cones are a close fit rather than
// exact: a sphere touching a cone's slope can sink into it a little before
// they collide.

// worldCollider is a node's collider placed in the world with worldMatrix:
// its center, its axis and the lengths along it, in world units.
export function worldCollider(collider, worldMatrix) {
  const m = worldMatrix.data || worldMatrix;
  // Matrix4 data is row-major, so the node's X and Y axes and its position
  // in the world are the first, second and last columns.
  const xAxis = [m[0], m[4], m[8]];
  const yAxis = [m[1], m[5], m[9]];
  const zAxis = [m[2], m[6], m[10]];
  const center = [m[3], m[7], m[11]];

  if (collider.shape === "sphere") {
    const scale = Math.max(length(xAxis), length(yAxis), length(zAxis));
    return {shape: "sphere", center, radius: (collider.radius ?? 1) * scale};
  }

  const yScale = length(yAxis);
  return {
    shape: collider.shape,
    center,
    axis: scaleVector(yAxis, 1 / (yScale || 1)),
    radius: (collider.radius ?? 1) * length(xAxis),
    halfHeight: ((collider.height ?? 2) / 2) * yScale,
  };
}

// collide is how sphere a overlaps shape b, or null when they don't touch:
// normal is the way to push a to get it out of b, and depth is how far.
export function collide(a, b) {
  if (a.shape !== "sphere") {
    return null;
  }

  switch (b.shape) {
    case "sphere":
      return sphereSphere(a, b);
    case "cylinder":
    case "cone":
      return sphereUpright(a, b);
    default:
      return null;
  }
}

// findCollisions is every node whose collider node's collider touches, as
// a list of {node, normal, depth} where normal and depth are which way and how
// far to push node to get it out of each one. worldMatrix places node's
// collider; it is node's world matrix by default, and a script that has just
// moved its node can pass where the node is now, since the node's world
// matrix is only updated when the scene is next drawn. A node never collides
// with itself or its own children.
export function findCollisions(sceneManager, node, worldMatrix = node.worldMatrix) {
  const collider = sceneManager.getNodeStateByID(node.id)?.collider;
  if (!collider) {
    return [];
  }

  const shape = worldCollider(collider, worldMatrix);
  const collisions = [];
  const others = Node.findChildrenByType(sceneManager.scene, Node);
  for (const other of others) {
    const otherCollider = sceneManager.getNodeStateByID(other.id)?.collider;
    if (!otherCollider || other === node || isInside(other, node)) {
      continue;
    }

    const contact = collide(shape, worldCollider(otherCollider, other.worldMatrix));
    if (contact) {
      collisions.push({node: other, ...contact});
    }
  }

  return collisions;
}

function isInside(node, parent) {
  for (let p = node.parent; p; p = p.parent) {
    if (p === parent) {
      return true;
    }
  }
  return false;
}

function sphereSphere(a, b) {
  const between = subtract(a.center, b.center);
  const distance = length(between);
  const depth = a.radius + b.radius - distance;
  if (depth <= 0) {
    return null;
  }
  return {normal: distance > 0 ? scaleVector(between, 1 / distance) : [0, 1, 0], depth};
}

// sphereUpright collides a sphere with a cylinder or a cone, from the point
// on the shape closest to the sphere's center.
function sphereUpright(a, b) {
  const {axis, halfHeight: h, radius: r} = b;
  const offset = subtract(a.center, b.center);
  const along = dot(offset, axis);
  const radial = subtract(offset, scaleVector(axis, along));
  const radialDistance = length(radial);
  const out = radialDistance > 0 ? scaleVector(radial, 1 / radialDistance) : perpendicular(axis);

  // A cone's radius shrinks from r at its base to nothing at its top.
  const radiusAt = (t) => (b.shape === "cone" ? (r * (h - t)) / (2 * h || 1) : r);

  const inside = Math.abs(along) <= h && radialDistance <= radiusAt(along);
  if (inside) {
    // The center is in the shape: push it out of whichever side is closest,
    // its wall, its top or its bottom.
    let wallNormal = out;
    let wallDepth = radiusAt(along) - radialDistance;
    if (b.shape === "cone") {
      // A cone's wall leans in, so its way out leans up.
      const slope = Math.hypot(2 * h, r) || 1;
      wallNormal = add(scaleVector(out, (2 * h) / slope), scaleVector(axis, r / slope));
      wallDepth *= (2 * h) / slope;
    }
    const exits = [
      {normal: wallNormal, depth: wallDepth},
      {normal: axis, depth: h - along},
      {normal: scaleVector(axis, -1), depth: along + h},
    ];
    const exit = exits.reduce((best, e) => (e.depth < best.depth ? e : best));
    return {normal: exit.normal, depth: exit.depth + a.radius};
  }

  const t = Math.max(-h, Math.min(h, along));
  const closest = add(
    scaleVector(axis, t),
    scaleVector(out, Math.min(radialDistance, radiusAt(t)))
  );
  const between = subtract(offset, closest);
  const distance = length(between);
  const depth = a.radius - distance;
  if (depth <= 0) {
    return null;
  }
  return {normal: distance > 0 ? scaleVector(between, 1 / distance) : out, depth};
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaleVector = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);

// perpendicular is any direction at a right angle to axis.
function perpendicular(axis) {
  const other = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const p = subtract(other, scaleVector(axis, dot(other, axis)));
  return scaleVector(p, 1 / length(p));
}
