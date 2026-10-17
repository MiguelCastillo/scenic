// glide lets the player race its node over a road like a hover racer: it
// always glides forward, along its node's +Z axis, at a set height over the
// ground, and the keys steer it.
// - Space: boost. It speeds up to boostSpeed, and settles back to cruising
//   when Space is let go.
// - Left and right arrows: steer, leaning into the turn.
// - Down arrow: brake, slowing to brakeSpeed.
//
// The road is the "road" in the state of the node the road setting names,
// {points, width}: the line down its middle, a loop from its first point
// back around to it, and how wide it is from edge to edge (see
// bin/generate-track.js). On the road, the ship goes as fast as the keys say.
// Off it, past its edges, it slows to offRoad of that, and once it is edge
// past an edge, the edge pushes it back toward the road and turns it back
// onto it, harder the farther out it is, like a soft wall.
//
// Keys come from the frame's `keys` and time from its `seconds`, so it glides
// at the same speed at any frame rate. Its settings come from
// "script.settings" in the node's config, and all are optional:
// - road: the ID of the node whose state has the road. "track" by default.
// - height: how high above the ground it glides. 70 by default.
// - ground: the ID of a terrain to glide over (see Terrain in
//   @scenic/runtime). Without one, the ground is flat at 0.
// - cruiseSpeed: how fast it glides, in scene units per second. 700 by
//   default.
// - boostSpeed: how fast it glides while boosting. 1600 by default.
// - brakeSpeed: how fast it glides while braking. 200 by default.
// - response: how quickly speed and leaning catch up with the keys, in
//   seconds. 0.4 by default.
// - turnRate: how fast it turns, in degrees per second. 90 by default.
// - bank: how far it leans into a turn, in degrees. 25 by default.
// - offRoad: how fast it goes off the road, as a part of its speed on it.
//   0.45 by default.
// - edge: how far past the road's edges it can go before being pushed back.
//   400 by default.
// - push: how hard the edge pushes it back, in scene units per second for
//   each unit past the edge. 4 by default.
//
// How it is gliding is written to this script's settings every frame, so a
// saved state glides on from where it was, and flames under the node that
// follow the throttle (see flame.js) burn harder when boosting:
// - heading: which way it heads, in degrees around the world's up axis. The
//   node's Y rotation by default.
// - roll: how far it leans, in degrees. 0 by default.
// - speed: how fast it is going. cruiseSpeed by default.
// - throttle: how hard its engine burns, from its speed: 0 braking, 0.3
//   cruising and 1 at full boost.
//
// In a network game, the other players see it when its node names a channel
// of sceneManager.network in its state, such as {"network": "player"}: every
// frame it publishes {position, rotation, throttle} there, for the copies of
// it on the other players' screens (see remote-ship.js).
const {mat4} = require("@scenic/math");

const defaults = {
  road: "track",
  height: 70,
  cruiseSpeed: 700,
  boostSpeed: 1600,
  brakeSpeed: 200,
  response: 0.4,
  turnRate: 90,
  bank: 25,
  offRoad: 0.45,
  edge: 400,
  push: 4,
};

// nearest is the point on the road's middle line nearest (x, z), its
// distance, and which way the road runs there, as a unit [x, z].
function nearest(points, x, z) {
  let best = {distance: Infinity};
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % points.length];
    const [dx, dz] = [bx - ax, bz - az];
    const length = Math.hypot(dx, dz) || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (length * length)));
    const point = [ax + dx * t, az + dz * t];
    const distance = Math.hypot(x - point[0], z - point[1]);
    if (distance < best.distance) {
      best = {point, distance, along: [dx / length, dz / length]};
    }
  }
  return best;
}

// turnToward is how many degrees to turn from heading to target, the short
// way around.
const turnToward = (heading, target) => ((((target - heading) % 360) + 540) % 360) - 180;

module.exports = function createGlideScript(node) {
  return {
    update({seconds = 0, keys = new Set(), sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const road = sceneManager.getNodeStateByID(settings.road)?.road;
      const glide = {
        heading: settings.heading ?? state.transform.rotation[1],
        roll: settings.roll ?? 0,
        speed: settings.speed ?? settings.cruiseSpeed,
      };

      const held = (code) => (keys.has(code) ? 1 : 0);
      const turn = held("ArrowLeft") - held("ArrowRight");

      // ease is how much of the way to a target to close this frame, to get
      // about two thirds of the way there after time seconds at any frame
      // rate.
      const ease = (time) => (time > 0 ? 1 - Math.exp(-seconds / time) : 1);

      // Turning left heads toward +X, the camera's left behind the ship. A
      // positive roll lowers its right side, so it leans into the turn.
      glide.heading += turn * settings.turnRate * seconds;
      glide.roll += (-turn * settings.bank - glide.roll) * ease(settings.response);

      let [x, , z] = state.transform.position;
      let target = held("ArrowDown")
        ? settings.brakeSpeed
        : held("Space")
        ? settings.boostSpeed
        : settings.cruiseSpeed;

      // Off the road it slows, and past the soft edge it is pushed back and
      // turned to face along the road, whichever way along it is nearer to
      // where it is heading.
      if (road) {
        const {point, distance, along} = nearest(road.points, x, z);
        const past = distance - road.width / 2;
        if (past > 0) {
          target *= settings.offRoad;
        }
        const beyond = past - settings.edge;
        if (beyond > 0) {
          const pushed = Math.min(beyond * settings.push, settings.boostSpeed) * seconds;
          x += ((point[0] - x) / distance) * pushed;
          z += ((point[1] - z) / distance) * pushed;
          // It turns toward a point on the road ahead of it, in whichever
          // direction along the road it is heading more, so it angles back
          // on rather than gliding along beside it.
          const forward = (Math.atan2(along[0], along[1]) * 180) / Math.PI;
          const way = Math.abs(turnToward(glide.heading, forward)) < 90 ? 1 : -1;
          const aim = [point[0] + along[0] * way * 800, point[1] + along[1] * way * 800];
          const roadHeading = (Math.atan2(aim[0] - x, aim[1] - z) * 180) / Math.PI;
          glide.heading +=
            turnToward(glide.heading, roadHeading) *
            Math.min(1, 0.3 + beyond / settings.edge) *
            ease(0.5);
        }
      }
      glide.speed += (target - glide.speed) * ease(settings.response);

      // Its nose, its local +Z axis, heads along the ground.
      const radians = (glide.heading * Math.PI) / 180;
      x += Math.sin(radians) * glide.speed * seconds;
      z += Math.cos(radians) * glide.speed * seconds;
      const terrain = settings.ground && sceneManager.getNodeByID(settings.ground);
      const y = (terrain ? terrain.heightAt(x, z) : 0) + settings.height;

      const matrix = mat4.multiply(
        mat4.identity(),
        mat4.rotate(mat4.identity(), 0, glide.heading, 0),
        mat4.rotate(mat4.identity(), 0, 0, glide.roll)
      );
      const {brakeSpeed, cruiseSpeed, boostSpeed} = settings;
      const throttle =
        glide.speed < cruiseSpeed
          ? 0.3 * Math.max(0, (glide.speed - brakeSpeed) / (cruiseSpeed - brakeSpeed || 1))
          : 0.3 + 0.7 * Math.min(1, (glide.speed - cruiseSpeed) / (boostSpeed - cruiseSpeed || 1));

      sceneManager.updateNodeStateByID(node.id, {
        transform: {...state.transform, position: [x, y, z], rotation: mat4.rotationAngles(matrix)},
        script: {...state.script, settings: {...state.script.settings, ...glide, throttle}},
      });

      if (state.network) {
        sceneManager.network.publish(state.network, {
          position: [x, y, z],
          rotation: mat4.rotationAngles(matrix),
          throttle,
        });
      }
    },
  };
};
