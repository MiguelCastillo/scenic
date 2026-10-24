// course runs a Mushroom Hops course: perches to land on in order, from the
// one the flier starts on to the last, against the clock (see Mushroom Hops
// in games/wingborn/README.md). The clock starts when the flier, having
// stood on the first perch, takes off from it, and stops when it lands on
// the last.
//
// A perch is a mushroom: a node with a perch collider under it, such as a
// cap's (see fly.js). Landing on any cap of a mushroom counts, such as one
// of a cluster's smaller ones. The flier is the node whose script settings
// have "perch", the ID of the perch it stands on, and "lastPerch", the ID
// of the last one it stood on, such as the ling's.
//
// A marker shows where to land next: its node is moved over the next
// perch's first cap, lying flat, as wide as the cap, and hidden once the
// course is done.
//
// Its settings come from "script.settings" in the node's config:
// - perches: the IDs of the mushrooms, in order, the first being where the
//   flier starts.
// - flier: the ID of the flier. "ling" by default.
// - marker: the ID of the marker's node, a ring such as one from
//   bin/generate-gate.js, which is 300 units wide. Optional.
// - markerRadius: how wide the marker's model is. 300 by default.
// - markerHeight: how far above the cap the marker floats. 40 by default.
//
// How the course is going is written to its settings every frame, so a
// saved state runs on from where it was:
// - next: the place in perches of the perch to land on next. 1 by default.
// - time: how long the run has taken, in seconds.
// - started and finished: whether the run has started, and ended.
//
// With "hud" in the node's state, such as {"hud": "course"}, it tells the
// app's UI how it is going every frame, on that channel of sceneManager.ui:
// {next, total, time, started, finished}, with next counted from 1, and
// total, how many perches there are to land on after the first.
const {collision} = require("@scenic/scene");

// capUnder is the first perch collider under node, where it is in the world:
// {center, radius, top}.
function capUnder(sceneManager, node) {
  for (const child of node.items) {
    const collider = sceneManager.getNodeStateByID(child.id)?.collider;
    if (collider?.perch) {
      const {center, radius, halfHeight} = collision.worldCollider(collider, child.worldMatrix);
      return {center, radius, top: center[1] + halfHeight};
    }
    const found = capUnder(sceneManager, child);
    if (found) {
      return found;
    }
  }
  return null;
}

// isUnder is whether the node id is node, or under it.
function isUnder(sceneManager, id, node) {
  for (let at = id && sceneManager.getNodeByID(id); at; at = at.parent) {
    if (at === node) {
      return true;
    }
  }
  return false;
}

module.exports = function createCourseScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings;
      const {
        perches = [],
        flier = "ling",
        marker,
        markerRadius = 300,
        markerHeight = 40,
      } = settings;
      const run = {
        next: settings.next ?? 1,
        time: settings.time ?? 0,
        started: !!settings.started,
        finished: !!settings.finished,
      };

      const flight = sceneManager.getNodeStateByID(flier)?.script?.settings ?? {};
      const perch = flight.perch ?? null;
      const start = sceneManager.getNodeByID(perches[0]);
      if (!run.started && perch === null && isUnder(sceneManager, flight.lastPerch, start)) {
        run.started = true;
      }
      if (run.started && !run.finished) {
        run.time += seconds;
        const next = sceneManager.getNodeByID(perches[run.next]);
        if (next && isUnder(sceneManager, perch, next)) {
          run.next += 1;
          run.finished = run.next >= perches.length;
        }
      }

      if (marker) {
        const next = !run.finished && sceneManager.getNodeByID(perches[run.next]);
        const cap = next && capUnder(sceneManager, next);
        const markerState = sceneManager.getNodeStateByID(marker);
        const size = cap ? (cap.radius * 1.1) / markerRadius : 1;
        sceneManager.updateNodeStateByID(marker, {
          visible: !!cap,
          transform: {
            ...markerState.transform,
            ...(cap && {position: [cap.center[0], cap.top + markerHeight, cap.center[2]]}),
            rotation: [90, 0, 0],
            scale: [size, size, size],
          },
        });
      }

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...settings, ...run}},
      });
      if (state.hud) {
        sceneManager.ui.publish(state.hud, {...run, total: perches.length - 1});
      }
    },
  };
};
