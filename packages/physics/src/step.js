// step moves a body forward seconds in time, pulled by gravity, pushed by
// force and slowed by drag, and returns {velocity, offset}: its new velocity,
// and how far it moved, both [x, y, z].
//
// - body: {mass, velocity}, how heavy it is, and how fast it is going, in
//   units per second.
// - gravity: the acceleration gravity gives everything, such as
//   [0, -2400, 0]. Gravity pulls on a body with mass times gravity, so a
//   heavier one needs more force to climb.
// - force: a push on the body, such as a wing's flap. [0, 0, 0] by default.
// - drag: how strongly the air slows the body, as force per unit of speed,
//   pushing against its velocity. 0 by default.
//
// It treats the forces as constant over the step and solves the step
// exactly, instead of in small increments, so a body moves the same way at
// any frame rate. With drag, its velocity eases toward its terminal
// velocity, where drag balances the other forces: (force + mass * gravity)
// / drag. A heavier body eases toward it more slowly, and its terminal
// velocity is faster.
export function step({mass, velocity}, {gravity, force = [0, 0, 0], drag = 0}, seconds) {
  const next = [0, 0, 0];
  const offset = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const v = velocity[axis];
    const acceleration = force[axis] / mass + gravity[axis];
    if (drag === 0) {
      next[axis] = v + acceleration * seconds;
      offset[axis] = v * seconds + (acceleration * seconds * seconds) / 2;
    } else {
      const rate = drag / mass;
      const terminal = acceleration / rate;
      const remaining = Math.exp(-rate * seconds);
      next[axis] = terminal + (v - terminal) * remaining;
      offset[axis] = terminal * seconds + ((v - terminal) * (1 - remaining)) / rate;
    }
  }
  return {velocity: next, offset};
}
