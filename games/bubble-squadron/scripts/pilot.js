// pilot flies a ship through a race's course of gates, for a racer the
// computer plays: it presses the ship's keys, the way a player would, on the
// input channel the ship's node names in its "input", such as "npc 1", so
// the ship flies by the same rules as the player's, with fly.js. Its node is
// a node of its own, beside the ship, since the ship's script is fly.js.
//
// It races: it steers for the next gate, through the middle of its
// opening, the arrows turning the ship toward it and climbing or diving
// toward its height, and it boosts with Space all the way, unless the gate
// is too tight a turn to make at full speed. A ship turns at the same rate
// at any speed, so the faster it goes the wider it turns, and a gate inside
// the circle it turns at full speed can't be reached at that speed: it
// cruises then, to turn tighter. A gate it misses it comes back around for,
// from in front. A pilot's skill sets how well it flies: how closely it
// steers, how quickly it reacts, and how fine it cuts its turns before it
// eases off. It fires its rocket booster once a lap (see fly.js), on a
// straight: lined up with the next gate, at least two seconds away at the
// booster's speed, and not too tight a turn at that speed.
//
// The race holds its ship until the race starts, as it does every racer's
// (see race.js, and "held" in fly.js), and it revs it up for the last second
// of the countdown. Once it has finished, it flies on through the gates
// without boosting, a lap of honor.
//
// Its settings come from "script.settings" in the node's config:
// - ship: the ID of the ship it flies.
// - course: the ID of the race's node, whose children are the gates, in
//   order, and whose settings say how the race is going (see race.js).
//   "race" by default.
// - skill: how well it flies, from 0 to 1. 0.7 by default.
// - gateRadius: how close to a ring gate's center it has to fly through it,
//   as race.js counts it. 300 by default.
//
// What it is doing is written to its settings every frame, so a saved state
// flies on from where it was:
// - gate: the index of the gate it is heading for. 0, the start gate, by
//   default.
// - keys: the keys it is pressing.
// - from: where the ship was last frame, to see which gates it crossed.
// - clock: how long it has flown, in seconds, for when it reacts.
// - reactedAt: when it last decided which keys to press.

const defaults = {
  course: "race",
  skill: 0.7,
  gateRadius: 300,
  gate: 0,
  keys: [],
  from: null,
  clock: 0,
  reactedAt: null,
};

const degrees = (radians) => (radians * 180) / Math.PI;

// turn is the shortest turn from one heading to another, in degrees, from
// -180 to 180.
const turn = (from, to) => ((((to - from + 180) % 360) + 360) % 360) - 180;

// gateFrame is a gate's place in the world, from its world matrix: its
// origin, its axes, in world units per unit of the gate's own, and its
// opening's middle, which for a ring is its origin and for a gantry,
// whose "gate" opening stands up from its origin, is halfway up it.
function gateFrame(gate, opening) {
  const g = gate.worldMatrix.data;
  const origin = [g[3], g[7], g[11]];
  const axis = (i) => [g[i], g[i + 4], g[i + 8]];
  const [xAxis, yAxis, zAxis] = [axis(0), axis(1), axis(2)];
  const middle = opening ? origin.map((v, i) => v + (yAxis[i] * opening.height) / 2) : origin;
  return {origin, xAxis, yAxis, zAxis, middle};
}

// flewThrough is whether a ship going from `from` to `to` flew through the
// gate, the way race.js counts it: across the plane it stands in, the way it
// faces, within its opening.
function flewThrough({origin, xAxis, yAxis, zAxis}, opening, gateRadius, from, to) {
  const along = (p, a) => {
    const lengthSquared = a.reduce((sum, v) => sum + v * v, 0) || 1;
    return p.reduce((sum, v, i) => sum + (v - origin[i]) * a[i], 0) / lengthSquared;
  };
  const [before, after] = [along(from, zAxis), along(to, zAxis)];
  if (before >= 0 || after < 0) {
    return false;
  }
  const t = before / (before - after);
  const crossing = from.map((v, i) => v + (to[i] - v) * t);
  const [x, y] = [along(crossing, xAxis), along(crossing, yAxis)];
  return opening
    ? Math.abs(x) <= opening.width / 2 && y >= 0 && y <= opening.height
    : Math.hypot(x, y) <= gateRadius;
}

module.exports = function createPilotScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const ship = sceneManager.getNodeByID(settings.ship);
      const shipState = sceneManager.getNodeStateByID(settings.ship);
      const course = sceneManager.getNodeByID(settings.course);
      const gates = course?.items ?? [];
      if (!ship || !shipState || !gates.length) {
        return;
      }
      const courseState = sceneManager.getNodeStateByID(settings.course);
      const race = courseState.script?.settings ?? {};
      const skill = Math.max(0, Math.min(1, settings.skill));
      const clock = settings.clock + seconds;

      // The race holds it until the countdown ends, like every racer.
      const finished = race.racers?.[settings.ship]?.finishedAt != null;
      const held = !!shipState.held;

      // Matrix4 data is row-major, so the ship's position is the last
      // column of its world matrix, and its nose, its Z axis, the third.
      const m = ship.worldMatrix.data;
      const to = [m[3], m[7], m[11]];
      const from = settings.from || to;
      const nose = [m[2], m[6], m[10]];
      const noseLength = Math.hypot(...nose) || 1;
      const heading = degrees(Math.atan2(nose[0], nose[2]));
      const climb = degrees(Math.asin(nose[1] / noseLength));

      // Through its gate, it heads for the next one.
      let gate = settings.gate % gates.length;
      const opening = () => sceneManager.getNodeStateByID(gates[gate].id).gate;
      if (
        flewThrough(gateFrame(gates[gate], opening()), opening(), settings.gateRadius, from, to)
      ) {
        gate = (gate + 1) % gates.length;
      }

      // It decides which keys to press only every so often, slower the
      // less skilled it is, and keeps pressing them in between.
      let keys = settings.keys;
      let reactedAt = settings.reactedAt;
      if (reactedAt == null || clock - reactedAt >= 0.05 + (1 - skill) * 0.25) {
        reactedAt = clock;
        const frame = gateFrame(gates[gate], opening());

        // It aims for the middle of the gate's opening, or, past the gate
        // having missed it, for a point in front of it, to come around and
        // fly through it the right way.
        const normal = frame.zAxis.map((v) => v / (Math.hypot(...frame.zAxis) || 1));
        const past = to.reduce((sum, v, i) => sum + (v - frame.origin[i]) * normal[i], 0);
        const aim = past > 0 ? frame.middle.map((v, i) => v - normal[i] * 900) : frame.middle;
        const [dx, dy, dz] = aim.map((v, i) => v - to[i]);
        const wantHeading = degrees(Math.atan2(dx, dz));
        const wantClimb = degrees(Math.atan2(dy, Math.hypot(dx, dz)));

        // Turning left turns toward a bigger heading (see fly.js). The more
        // skilled, the closer it steers.
        const slack = 2 + (1 - skill) * 8;
        const turning = turn(heading, wantHeading);
        const shipSettings = shipState.script?.settings ?? {};
        const climbKey = shipSettings.upArrowDives === false ? "ArrowUp" : "ArrowDown";
        const diveKey = climbKey === "ArrowUp" ? "ArrowDown" : "ArrowUp";

        // It boosts unless the gate is inside the circle it turns at full
        // speed: a point a distance away and an angle off its heading is
        // out of reach of a turn that wide when the distance is under the
        // circle's chord to it, twice its radius times the angle's sine. The
        // less skilled, the wider the margin it leaves. It revs up for the
        // start.
        const {
          boostSpeed = 1200,
          turnRate = 75,
          boosterSpeedUp = 0.4,
          boosterLap = null,
          boosterLeft = 0,
        } = shipSettings;
        const boosterSpeed = boostSpeed * (1 + boosterSpeedUp);
        const radius = (speed) => speed / ((turnRate * Math.PI) / 180);
        const angle = (Math.min(90, Math.abs(turning)) * Math.PI) / 180;
        const margin = 1.05 + (1 - skill) * 0.8;
        const distance = Math.hypot(dx, dy, dz);
        const reachable = (speed) => distance >= margin * 2 * radius(speed) * Math.sin(angle);
        const boosting = held
          ? race.countdown != null && race.countdown < 1
          : !finished && reachable(boosterLeft > 0 ? boosterSpeed : boostSpeed);

        // The booster, once a lap, on a straight.
        const lap = shipState.lap ?? 0;
        const firing =
          boosting &&
          !held &&
          lap > 0 &&
          boosterLap !== lap &&
          Math.abs(turning) < 15 &&
          distance >= 2 * boosterSpeed &&
          reachable(boosterSpeed);

        keys = [
          ...(turning > slack ? ["ArrowLeft"] : turning < -slack ? ["ArrowRight"] : []),
          ...(wantClimb - climb > 4 ? [climbKey] : wantClimb - climb < -4 ? [diveKey] : []),
          ...(boosting ? ["Space"] : []),
          ...(firing ? ["KeyB"] : []),
        ];
      }

      // It presses and lets go of keys on the ship's input channel, as a
      // player's keyboard would.
      const channel = shipState.input;
      if (channel) {
        for (const code of keys.filter((code) => !settings.keys.includes(code))) {
          sceneManager.input.publish(channel, {type: "keydown", code});
        }
        for (const code of settings.keys.filter((code) => !keys.includes(code))) {
          sceneManager.input.publish(channel, {type: "keyup", code});
        }
      }

      sceneManager.updateNodeStateByID(node.id, {
        script: {
          ...state.script,
          settings: {...state.script.settings, gate, keys, from: to, clock, reactedAt},
        },
      });
    },
  };
};
