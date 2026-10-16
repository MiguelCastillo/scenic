// race runs a race through a course of gates: its node's children, such as
// rings from bin/generate-gate.js, in the order they are flown through. The
// first gate is the start and the finish. Flying through it starts the clock
// and the first lap, a lap is every other gate in order and then the first
// one again, and the race is over after the last lap. Flying through the
// start gate after that races again.
//
// A gate is flown through when the racer crosses the plane it stands in, its
// local XY plane, within its opening, going the way it faces, along its +Z
// axis, so a course turns its gates to face along it. A gate's opening is a
// circle gateRadius around its origin, such as a ring's, or the rectangle
// given by "gate" in its state, {width, height}, from its origin up, such as
// a start gantry's (see bin/generate-gate.js). Both are in the gate's own
// units, so they scale with it. Gates flown through backwards or out of turn
// don't count, so a racer can't skip any. The next gate glows, the ones
// still ahead this lap are see-through, and the ones already flown through
// fade further, by setting their material's color and opacity. The start gate
// is always solid, so the start and finish stand out.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - racer: the ID of the node that races, such as a starfighter flown with
//   fly.js. "starfighter" by default.
// - laps: how many laps a race is. 3 by default.
// - gateRadius: how close to a ring gate's center the racer has to fly
//   through it. 300 by default, the radius of a ring from
//   bin/generate-gate.js.
// - glow: the color added to the next gate. [0.35, 0.3, 0.05] by default.
// - opacity: the opacity of the gates still ahead. 0.6 by default.
// - passedOpacity: the opacity of the gates flown through this lap. 0.2 by
//   default.
//
// How the race is going is written to its settings every frame, so a saved
// state races on from where it was:
// - lap: the lap being raced, 1 for the first, or 0 before the start.
// - gate: the index of the next gate.
// - time: the race's time so far, in seconds.
// - lapTimes: how long each lap took, in seconds.
// - finished: whether the race is over.
// - best: the fastest race's time, in seconds, or null before one finishes.
// - from: where the racer was in the world last frame, to see which gates it
//   crossed since.
// The clock runs on the frame's `seconds`, so it stops while the scene is
// paused.
//
// With "hud" in its node's state, such as {"hud": "race"}, it tells the app's
// UI how the race is going every frame, on that channel of sceneManager.ui
// (see SceneManager in @scenic/scene): {lap, laps, time, gate, gates, best,
// finished}, as in its settings, with gates the number of gates after the
// start gate.

const defaults = {
  racer: "starfighter",
  laps: 3,
  gateRadius: 300,
  glow: [0.35, 0.3, 0.05],
  opacity: 0.6,
  passedOpacity: 0.2,
  lap: 0,
  gate: 0,
  time: 0,
  lapTimes: [],
  finished: false,
  best: null,
  from: null,
};

module.exports = function createRaceScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const gates = node.items;
      const racer = sceneManager.getNodeByID(settings.racer);
      if (!racer || !gates.length) {
        return;
      }

      const race = {
        lap: settings.lap,
        gate: settings.gate,
        time: settings.time,
        lapTimes: settings.lapTimes,
        finished: settings.finished,
        best: settings.best,
      };
      if (race.lap > 0 && !race.finished) {
        race.time += seconds;
      }

      // Matrix4 data is row-major, so a node's position in the world is the
      // last column of its world matrix, and its Z axis the third.
      const m = racer.worldMatrix.data;
      const to = [m[3], m[7], m[11]];
      const from = settings.from || to;

      // Whether the racer flew through the gate from `from` to `to`: where
      // that path crosses the gate's plane, if it does, is within its
      // opening. Points are measured along the gate's own axes, which are
      // divided by their length squared so that the measure is in the gate's
      // own units.
      const flewThrough = (gate) => {
        const g = gate.worldMatrix.data;
        const origin = [g[3], g[7], g[11]];
        const axis = (i) => {
          const v = [g[i], g[i + 4], g[i + 8]];
          const lengthSquared = v.reduce((sum, x) => sum + x * x, 0) || 1;
          return v.map((x) => x / lengthSquared);
        };
        const along = (p, a) => p.reduce((sum, v, i) => sum + (v - origin[i]) * a[i], 0);
        const [xAxis, yAxis, zAxis] = [axis(0), axis(1), axis(2)];
        const [before, after] = [along(from, zAxis), along(to, zAxis)];
        if (before >= 0 || after < 0) {
          return false;
        }
        const t = before / (before - after);
        const crossing = from.map((v, i) => v + (to[i] - v) * t);
        const [x, y] = [along(crossing, xAxis), along(crossing, yAxis)];
        const opening = sceneManager.getNodeStateByID(gate.id).gate;
        return opening
          ? Math.abs(x) <= opening.width / 2 && y >= 0 && y <= opening.height
          : Math.hypot(x, y) <= settings.gateRadius;
      };

      if (flewThrough(gates[race.gate])) {
        if (race.gate !== 0) {
          race.gate = (race.gate + 1) % gates.length;
        } else if (race.lap === 0 || race.finished) {
          // Through the start gate: the race starts, or starts over.
          Object.assign(race, {
            lap: 1,
            gate: 1 % gates.length,
            time: 0,
            lapTimes: [],
            finished: false,
          });
        } else {
          // Through the finish gate: a lap is done.
          const lapped = race.lapTimes.reduce((sum, v) => sum + v, 0);
          race.lapTimes = [...race.lapTimes, race.time - lapped];
          if (race.lap >= settings.laps) {
            race.finished = true;
            race.best = race.best == null ? race.time : Math.min(race.best, race.time);
          } else {
            race.lap += 1;
            race.gate = 1 % gates.length;
          }
        }
      }

      // The next gate glows. Before the start and after the finish that is
      // the start gate, and the rest wait.
      const waiting = race.lap === 0 || race.finished;
      gates.forEach((gate, i) => {
        const gateState = sceneManager.getNodeStateByID(gate.id);
        if (!gateState.material) {
          return;
        }
        const next = i === race.gate;
        // Heading back to the start gate, every other gate has been passed.
        const passed = !waiting && i !== 0 && (race.gate === 0 || i < race.gate);
        const opacity = next || i === 0 ? 1 : passed ? settings.passedOpacity : settings.opacity;
        const color = next ? [...settings.glow, 1] : [0, 0, 0, 1];
        sceneManager.updateNodeStateByID(gate.id, {
          material: {...gateState.material, color, opacity},
        });
      });

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...state.script.settings, ...race, from: to}},
      });

      if (state.hud) {
        const {lap, time, gate, best, finished} = race;
        sceneManager.ui.publish(state.hud, {
          lap,
          laps: settings.laps,
          time,
          gate,
          gates: gates.length - 1,
          best,
          finished,
        });
      }
    },
  };
};
