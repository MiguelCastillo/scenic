// flame makes its node flicker like a flame: it stretches and shrinks its
// length and swells and narrows its width, quickly and unevenly. It is meant
// for flames made by bin/generate-flame.js, which point down their node's -Z
// axis, so the length is the node's Z scale. It burns around the node's own
// scale and material color, so the node's config still sizes and colors it.
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - throttle: how hard the flame burns, 0 to 1. A flame at 0
//   still burns, short and narrow, like an idling engine. At 1 it roars like
//   a rocket taking off: over twice as long, wider, whiter, and flickering
//   harder and faster. Changing it in the node's state, such as from a
//   flight script or the editor's Script tab, changes the flame live.
//   Without a throttle of its own, a flame follows the throttle in the script
//   settings of the nearest node above it that has one, so all of a rocket's
//   flames can follow one throttle on the rocket. Without either, it is 1.
// - flicker: how much it flickers, as a fraction of its size. 0.15 by default.
// - speed: how fast it flickers. 1 by default.
//
// Each flame flickers on its own rhythm, picked from its node's id, so flames
// next to each other do not flicker together.

module.exports = function createFlameScript(node) {
  // The scale and color the flame burns around. They are read on the first
  // frame, once the node's state is set up.
  let start = null;

  // The flame's own clock, which runs faster the harder it burns. It moves
  // forward a frame at a time, so a throttle change speeds the flicker up or
  // slows it down without making it jump.
  let clock = 0;
  let lastMs = null;

  // A phase from the node's id, so that every flame is out of step with the
  // others.
  let phase = 0;
  for (const char of String(node.id)) {
    phase = (phase * 31 + char.charCodeAt(0)) % 1000;
  }

  // noise is an uneven wobble between about -1 and 1, made from waves whose
  // speeds do not line up, so it never visibly repeats.
  const noise = (t, offset) =>
    0.5 * Math.sin(t * 11.3 + phase + offset) +
    0.3 * Math.sin(t * 17.9 + phase * 2 + offset) +
    0.2 * Math.sin(t * 29.1 + phase * 3 + offset);

  // findThrottle is the throttle in the script settings of the nearest node
  // above the flame that has one, or undefined when none does.
  const findThrottle = (sceneManager) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      const throttle = sceneManager.getNodeStateByID(parent.id)?.script?.settings?.throttle;
      if (throttle != null) {
        return throttle;
      }
    }
    return undefined;
  };

  return {
    preRender({ms, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      if (!start) {
        start = {
          scale: [...state.transform.scale],
          color: [...(state.material?.color || [0, 0, 0, 1])],
        };
      }

      const {throttle: own, flicker = 0.15, speed = 1} = state.script.settings || {};
      const throttle = Math.min(Math.max(own ?? findThrottle(sceneManager) ?? 1, 0), 1);

      // A harder burning flame flickers faster and harder.
      clock += ((lastMs == null ? 0 : ms - lastMs) / 1000) * speed * (1 + throttle);
      lastMs = ms;
      const t = clock;
      const shake = flicker * (0.6 + 0.6 * throttle);

      // It is also much longer, growing faster near full throttle, and wider.
      const length = (0.35 + 1.85 * Math.pow(throttle, 1.3)) * (1 + shake * noise(t, 0));
      const width = (0.8 + 0.45 * throttle) * (1 + shake * 0.4 * noise(t, 2));

      // And it burns hotter: the material color adds to the flame's vertex
      // colors, so adding warm white pushes it toward white-hot.
      const heat = throttle * throttle;
      const [r, g, b, a] = start.color;

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          scale: [start.scale[0] * width, start.scale[1] * width, start.scale[2] * length],
        },
        material: {
          ...state.material,
          color: [r + 0.25 * heat, g + 0.25 * heat, b + 0.15 * heat, a],
        },
      });
    },
  };
};
