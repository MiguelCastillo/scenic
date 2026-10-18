// race runs a race through a course of gates: its node's children, such as
// rings from bin/generate-gate.js, in the order they are flown through. The
// first gate is the start and the finish. The race starts with a countdown,
// while the racers are held at the start, behind the start gate, and at its
// end they are let go and the clock starts. A lap is every other gate in
// order and then the first one again, and a racer is done after the last
// lap. The countdown runs on the frame's seconds, so it waits while the
// scene is paused, such as until the player joins the race by clicking.
//
// Who races: the node called racer, the player's own, if the scene has it,
// and the entrants, such as NPCs, which the app or the server puts in the
// race (see addRacer in @scenic/racers). The race follows each of them
// through the gates the same way, from the start, and places them all:
// whoever has finished, by when, ahead of whoever hasn't, and of those,
// whoever is on a later lap, then past more gates, then nearer the next one.
// On a server, where everyone racing is an entrant, the scene has no racer
// of its own.
//
// The racers are held by setting "held" in their nodes' state, which the
// scripts that fly them heed (see fly.js and glide.js), and the lap each is
// on is set as "lap" in its node's state, or 0 before the start and after it
// finishes, for its rocket booster, which it can fire once a lap.
//
// A gate is flown through when a racer crosses the plane it stands in, its
// local XY plane, within its opening, going the way it faces, along its +Z
// axis, so a course turns its gates to face along it. A gate's opening is a
// circle gateRadius around its origin, such as a ring's, or the rectangle
// given by "gate" in its state, {width, height}, from its origin up, such as
// a start gantry's (see bin/generate-gate.js). Both are in the gate's own
// units, so they scale with it. Gates flown through backwards or out of turn
// don't count, so a racer can't skip any.
//
// The race shows one racer's view of it: the player's. Their next gate
// glows, the ones still ahead this lap are see-through, and the ones already
// flown through fade further, by setting their material's color and
// opacity. The start gate is always solid, so the start and finish stand
// out.
//
// It hears from the app on the input channel its node's "input" names, such
// as {"input": "room"} (see games/README.md):
// - {waitingForPlayers}: in a room, whether the race is still waiting for
//   the players to be ready, true until they all are. Its countdown runs only
//   once the latest says false. Without any, it runs once the scene plays.
//   The server tells its race this.
// - {race, you}: a race run somewhere else, on the server, for the app to
//   show: race is how it is going, as the server's race has it in its
//   settings (see below), and you the id the player's racer has there, or
//   null while they aren't racing. A race told this follows it instead of
//   running its own, and shows it from you's view. race is null until the
//   server has said how the race is going.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - racer: the ID of the node that is the player, such as a starfighter flown
//   with fly.js. "starfighter" by default.
// - laps: how many laps a race is. 3 by default.
// - countdown: how long the countdown is, in seconds. 5 by default.
// - gateRadius: how close to a ring gate's center a racer has to fly
//   through it. 300 by default, the radius of a ring from
//   bin/generate-gate.js.
// - glow: the color added to the next gate. [0.35, 0.3, 0.05] by default.
// - opacity: the opacity of the gates still ahead. 0.6 by default.
// - passedOpacity: the opacity of the gates flown through this lap. 0.2 by
//   default.
// - racerName: what the racer is called in the results. "You" by default.
// - entrants: the others racing, as [{id, name}]: the ids of their nodes,
//   and what they are called in the results.
//
// How the race is going is written to its settings every frame, so a saved
// state races on from where it was:
// - waitingForPlayers: whether the race is waiting for the players in a room
//   before its countdown, as the latest message said. false by default.
// - countdown: how long until the start, in seconds, counting down to 0.
// - started: whether the countdown has ended.
// - clock: the race's time since the start, in seconds.
// - racers: how each racer is doing, by the id of its node: {lap, gate,
//   finishedAt, from}, the lap it is on, from 1, or 0 before the start, the
//   index of its next gate, the clock when it finished, or null, and where
//   it was in the world last frame, to see which gates it crossed since.
// - standings: everyone's place, first first, as [{id, name, finishedAt}].
// - you: whose view of the race it shows: the racer's id, or for a race run
//   somewhere else, you, as told.
// The clock runs on the frame's `seconds`, so it stops while the scene is
// paused.
//
// With "hud" in its node's state, such as {"hud": "race"}, it tells the app's
// UI how the race is going for the player every frame, on that channel of
// sceneManager.ui (see SceneManager in @scenic/scene): {countdown, lap, laps,
// time, gate, gates, finished, place, racers, results}, with lap 0 before the
// start, time the player's time since the start, or their finishing time,
// gates the number of gates after the start gate, place the player's place,
// from 1, racers how many are racing, and results those who have finished,
// in order, as [{name, time, racer}], with racer true for the player.

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
  waitingForPlayers: false,
  started: false,
  clock: 0,
  racers: {},
  standings: [],
  you: null,
};

// position is where a node is in the world: the last column of its world
// matrix, since Matrix4 data is row-major.
const position = (node) => {
  const m = node.worldMatrix.data;
  return [m[3], m[7], m[11]];
};

module.exports = function createRaceScript(node) {
  return {
    update({seconds = 0, messages = [], sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const gates = node.items;
      if (!gates.length) {
        return;
      }
      const latest = messages.at(-1);

      // A race run somewhere else is followed, and one run here is run.
      const following = latest && "race" in latest;
      const race = following
        ? {...latest.race, you: latest.you}
        : runRace({settings, seconds, latest, gates, sceneManager});

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...state.script.settings, ...race}},
      });

      // The player's view: their next gate glows. Before the start and
      // after the finish that is the start gate, and the rest wait.
      const mine = race.racers?.[race.you];
      const waiting = !mine || mine.lap === 0 || mine.finishedAt != null;
      const next = waiting ? 0 : mine.gate;
      gates.forEach((gate, i) => {
        const gateState = sceneManager.getNodeStateByID(gate.id);
        if (!gateState.material) {
          return;
        }
        // Heading back to the start gate, every other gate has been passed.
        const passed = !waiting && i !== 0 && (next === 0 || i < next);
        const opacity =
          i === next || i === 0 ? 1 : passed ? settings.passedOpacity : settings.opacity;
        const color = i === next ? [...settings.glow, 1] : [0, 0, 0, 1];
        sceneManager.updateNodeStateByID(gate.id, {
          material: {...gateState.material, color, opacity},
        });
      });

      if (state.hud) {
        const standings = race.standings ?? [];
        const finished = mine?.finishedAt != null;
        sceneManager.ui.publish(state.hud, {
          countdown: race.countdown ?? settings.countdown,
          lap: mine?.lap ?? 0,
          laps: race.laps ?? settings.laps,
          time: finished ? mine.finishedAt : race.started ? race.clock : 0,
          gate: mine?.gate ?? 0,
          gates: gates.length - 1,
          finished,
          place: standings.findIndex(({id}) => id === race.you) + 1,
          racers: standings.length,
          results: standings
            .filter(({finishedAt}) => finishedAt != null)
            .map(({id, name, finishedAt}) => ({name, time: finishedAt, racer: id === race.you})),
        });
      }
    },
  };
};

// runRace runs the race a frame forward, seconds on, and returns how it is
// going, as its settings have it (see above), from settings, as they were
// last frame, and latest, the latest message to it.
function runRace({settings, seconds, latest, gates, sceneManager}) {
  const waitingForPlayers = latest?.waitingForPlayers ?? settings.waitingForPlayers;
  let {countdown, started, clock} = settings;

  // The countdown's end starts the race, and the clock. In a room, it counts
  // down only once everyone is ready.
  if (started) {
    clock += seconds;
  } else if (!waitingForPlayers) {
    countdown = Math.max(0, countdown - seconds);
    started = countdown === 0;
  }

  // Whether a racer flew through the gate from `from` to `to`: where that
  // path crosses the gate's plane, if it does, is within its opening. Points
  // are measured along the gate's own axes, which are divided by their
  // length squared so that the measure is in the gate's own units. A gate's
  // Z axis is the third column of its world matrix.
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

  // Every racer goes through the gates the same way, from the start toward
  // the first gate after the start gate, which it flies through on its way
  // from behind it, and is held until then.
  const entered = [
    ...(sceneManager.getNodeByID(settings.racer)
      ? [{id: settings.racer, name: settings.racerName}]
      : []),
    ...settings.entrants.filter(({id}) => sceneManager.getNodeByID(id)),
  ];
  const racers = {};
  for (const {id} of entered) {
    const to = position(sceneManager.getNodeByID(id));
    const from = settings.racers[id]?.from || to;
    const racer = {lap: 0, gate: 0, finishedAt: null, ...settings.racers[id], from: to};
    if (racer.lap === 0 && started) {
      Object.assign(racer, {lap: 1, gate: 1 % gates.length});
    } else if (
      racer.lap > 0 &&
      racer.finishedAt == null &&
      flewThrough(gates[racer.gate], from, to)
    ) {
      if (racer.gate !== 0) {
        racer.gate = (racer.gate + 1) % gates.length;
      } else if (racer.lap >= settings.laps) {
        racer.finishedAt = clock;
      } else {
        Object.assign(racer, {lap: racer.lap + 1, gate: 1 % gates.length});
      }
    }
    racers[id] = racer;

    const racerState = sceneManager.getNodeStateByID(id);
    const lap = racer.finishedAt == null ? racer.lap : 0;
    if (!!racerState.held === started || (racerState.lap ?? 0) !== lap) {
      sceneManager.updateNodeStateByID(id, {held: !started, lap});
    }
  }

  // Everyone's place: whoever has finished, by when, then whoever is on a
  // later lap, past more gates, and nearer the next one. Heading for the
  // start gate is past every other gate of the lap.
  const standings = entered
    .map(({id, name}) => {
      const {lap, gate, finishedAt} = racers[id];
      const at = position(sceneManager.getNodeByID(id));
      const distance = Math.hypot(...position(gates[gate]).map((v, i) => v - at[i]));
      return {
        id,
        name,
        finishedAt,
        progress: lap * gates.length + (gate || gates.length),
        distance,
      };
    })
    .sort((a, b) =>
      a.finishedAt != null || b.finishedAt != null
        ? (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity)
        : b.progress - a.progress || a.distance - b.distance
    )
    .map(({id, name, finishedAt}) => ({id, name, finishedAt}));

  const you = sceneManager.getNodeByID(settings.racer) ? settings.racer : null;
  return {waitingForPlayers, countdown, started, clock, racers, standings, you};
}
