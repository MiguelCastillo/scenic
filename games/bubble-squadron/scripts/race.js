// race runs a race through a course of gates: its node's children, such as
// rings from bin/generate-gate.js, in the order they are flown through. The
// first gate is the start and the finish. The race starts with a countdown,
// while the racer is held at the start, behind the start gate, and at its
// end the racer is let go and the clock starts. A lap is every other gate in
// order and then the first one again, and the race is over after the last
// lap. The countdown runs on the frame's seconds, so it waits while the
// scene is paused, such as until the player joins the race by clicking.
//
// The racer is held by setting "held" in its node's state, which the
// scripts that fly it heed (see fly.js and glide.js). Every racer, the
// others too, has the lap it is on set as "lap" in its node's state, or 0
// before the start and after it finishes, for its rocket booster, which it
// can fire once a lap (see fly.js and glide.js).
//
// Others can race too, such as NPCs flown by pilot.js: each enters the race
// by adding itself to the race's entrants, and the race follows them through
// the gates the same way, from the start, and places everyone: whoever has
// finished, by when, ahead of whoever hasn't, and of those, whoever is on a
// later lap, then past more gates, then nearer the next one. Only the
// racer's own gates glow, and the others hold themselves at the start.
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
// - countdown: how long the countdown is, in seconds. 5 by default.
// - gateRadius: how close to a ring gate's center the racer has to fly
//   through it. 300 by default, the radius of a ring from
//   bin/generate-gate.js.
// - glow: the color added to the next gate. [0.35, 0.3, 0.05] by default.
// - opacity: the opacity of the gates still ahead. 0.6 by default.
// - passedOpacity: the opacity of the gates flown through this lap. 0.2 by
//   default.
// - racerName: what the racer is called in the results. "You" by default.
// - entrants: the others racing, as [{id, name}]: the ids of their nodes,
//   and what they are called in the results. Racers add themselves to it.
//
// How the race is going is written to its settings every frame, so a saved
// state races on from where it was:
// - lap: the lap being raced, 1 for the first, or 0 before the start.
// - countdown: how long until the start, in seconds, counting down to 0.
// - gate: the index of the next gate.
// - time: the race's time so far, in seconds.
// - lapTimes: how long each lap took, in seconds.
// - finished: whether the race is over.
// - best: the fastest race's time, in seconds, or null before one finishes.
// - from: where the racer was in the world last frame, to see which gates it
//   crossed since.
// - clock: the race's time since the start, in seconds, which runs on after
//   the racer finishes, for the others.
// - rivals: how each of the others is doing, by id: {lap, gate, finishedAt,
//   from}, with finishedAt the clock when they finished, or null.
// The clock runs on the frame's `seconds`, so it stops while the scene is
// paused.
//
// With "hud" in its node's state, such as {"hud": "race"}, it tells the app's
// UI how the race is going every frame, on that channel of sceneManager.ui
// (see SceneManager in @scenic/scene): {countdown, lap, laps, time, gate,
// gates, best, finished, place, racers, results}, as in its settings, with
// gates the number of gates after the start gate, place the racer's place,
// from 1, racers how many are racing, and results those who have finished,
// in order, as [{name, time, racer}], with racer true for the racer.

const defaults = {
  racer: "starfighter",
  laps: 3,
  countdown: 5,
  gateRadius: 300,
  glow: [0.35, 0.3, 0.05],
  opacity: 0.6,
  passedOpacity: 0.2,
  racerName: "You",
  entrants: [],
  lap: 0,
  gate: 0,
  time: 0,
  lapTimes: [],
  finished: false,
  best: null,
  from: null,
  clock: 0,
  rivals: {},
};

// position is where a node is in the world: the last column of its world
// matrix, since Matrix4 data is row-major.
const position = (node) => {
  const m = node.worldMatrix.data;
  return [m[3], m[7], m[11]];
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
        countdown: settings.countdown,
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
      let raceClock = race.lap > 0 ? settings.clock + seconds : 0;

      // The countdown's end starts the race: the first lap, and the clock,
      // toward the first gate after the start gate, which the racer flies
      // through on its way from behind it.
      if (race.lap === 0) {
        race.countdown = Math.max(0, race.countdown - seconds);
        if (race.countdown === 0) {
          Object.assign(race, {lap: 1, gate: 1 % gates.length, time: 0, lapTimes: []});
          raceClock = 0;
        }
      }
      const held = race.lap === 0;
      if (!!sceneManager.getNodeStateByID(racer.id).held !== held) {
        sceneManager.updateNodeStateByID(racer.id, {held});
      }

      // setLap sets the lap a racer is on in its node's state, when it
      // changed.
      const setLap = (id, lap) => {
        if ((sceneManager.getNodeStateByID(id).lap ?? 0) !== lap) {
          sceneManager.updateNodeStateByID(id, {lap});
        }
      };

      const to = position(racer);
      const from = settings.from || to;

      // Whether a racer flew through the gate from `from` to `to`: where
      // that path crosses the gate's plane, if it does, is within its
      // opening. Points are measured along the gate's own axes, which are
      // divided by their length squared so that the measure is in the gate's
      // own units. A gate's Z axis is the third column of its world matrix.
      const flewThrough = (gate, from, to) => {
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

      if (race.lap > 0 && !race.finished && flewThrough(gates[race.gate], from, to)) {
        if (race.gate !== 0) {
          race.gate = (race.gate + 1) % gates.length;
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

      setLap(racer.id, race.finished ? 0 : race.lap);

      // The others go through the gates the same way, from the start.
      const rivals = {};
      for (const {id} of settings.entrants) {
        const rivalNode = sceneManager.getNodeByID(id);
        if (!rivalNode) {
          continue;
        }
        const rivalTo = position(rivalNode);
        const rival = {lap: 0, gate: 0, finishedAt: null, ...settings.rivals[id], from: rivalTo};
        const rivalFrom = settings.rivals[id]?.from || rivalTo;
        if (rival.lap === 0 && race.lap > 0) {
          Object.assign(rival, {lap: 1, gate: 1 % gates.length});
        } else if (
          rival.lap > 0 &&
          rival.finishedAt == null &&
          flewThrough(gates[rival.gate], rivalFrom, rivalTo)
        ) {
          if (rival.gate !== 0) {
            rival.gate = (rival.gate + 1) % gates.length;
          } else if (rival.lap >= settings.laps) {
            rival.finishedAt = raceClock;
          } else {
            Object.assign(rival, {lap: rival.lap + 1, gate: 1 % gates.length});
          }
        }
        rivals[id] = rival;
        setLap(id, rival.finishedAt == null ? rival.lap : 0);
      }

      // Everyone's place: whoever has finished, by when, then whoever is on
      // a later lap, past more gates, and nearer the next one. Heading for
      // the start gate is past every other gate of the lap.
      const standing = ({lap, gate, finishedAt}, at) => {
        const next = gates[gate];
        const distance = Math.hypot(...position(next).map((v, i) => v - at[i]));
        return {finishedAt, progress: lap * gates.length + (gate || gates.length), distance};
      };
      const racers = [
        {
          name: settings.racerName,
          racer: true,
          ...standing({...race, finishedAt: race.finished ? race.time : null}, to),
        },
        ...settings.entrants
          .filter(({id}) => rivals[id])
          .map(({id, name}) => ({
            name,
            racer: false,
            ...standing(rivals[id], position(sceneManager.getNodeByID(id))),
          })),
      ].sort((a, b) =>
        a.finishedAt != null || b.finishedAt != null
          ? (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity)
          : b.progress - a.progress || a.distance - b.distance
      );
      const place = racers.findIndex(({racer}) => racer) + 1;
      const results = racers
        .filter(({finishedAt}) => finishedAt != null)
        .map(({name, finishedAt, racer}) => ({name, time: finishedAt, racer}));

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
        script: {
          ...state.script,
          settings: {...state.script.settings, ...race, from: to, clock: raceClock, rivals},
        },
      });

      if (state.hud) {
        const {countdown, lap, time, gate, best, finished} = race;
        sceneManager.ui.publish(state.hud, {
          countdown,
          lap,
          laps: settings.laps,
          time,
          gate,
          gates: gates.length - 1,
          best,
          finished,
          place,
          racers: racers.length,
          results,
        });
      }
    },
  };
};
