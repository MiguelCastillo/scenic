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
// - boost: how far past full throttle it burns, 0 to 1, such as while a
//   rocket's booster fires: at 1 it roars like a giant booster, three times
//   as long, twice as wide, white-hot, and flickering harder and faster. It comes from the same place as the throttle: its own
//   settings, or the node above it whose throttle it follows. 0 by default.
// - flicker: how much it flickers, as a fraction of its size. 0.15 by default.
// - speed: how fast it flickers. 1 by default.
//
// What it changes as it burns is also in its settings, so a saved state burns
// on from where it was:
// - scale and color: the scale and material color it burns around. The
//   node's own on the first frame by default.
// - time: how far its flicker has got, which runs faster the harder it
//   burns. It moves forward a frame at a time, by the frame's `seconds`, so a
//   throttle change speeds the flicker up or slows it down without making it
//   jump. 0 by default.
//
// Each flame flickers on its own rhythm, picked from its node's id, so flames
// next to each other do not flicker together.

// noise is an uneven wobble between about -1 and 1 at time t, made from waves
// whose speeds do not line up, so it never visibly repeats. phase puts each
// flame out of step with the others.
function noise(t, phase, offset) {
  return (
    0.5 * Math.sin(t * 11.3 + phase + offset) +
    0.3 * Math.sin(t * 17.9 + phase * 2 + offset) +
    0.2 * Math.sin(t * 29.1 + phase * 3 + offset)
  );
}

module.exports = function createFlameScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {
        flicker = 0.15,
        speed = 1,
        scale = state.transform.scale,
        color = state.material?.color || [0, 0, 0, 1],
      } = settings;

      // Without a throttle of its own, the flame follows the nearest node
      // above it that has one.
      // Its boost comes from the same settings.
      let source = settings;
      for (let parent = node.parent; source.throttle == null && parent; parent = parent.parent) {
        source = sceneManager.getNodeStateByID(parent.id)?.script?.settings ?? {};
      }
      const throttle = Math.min(Math.max(source.throttle ?? 1, 0), 1);
      const boost = Math.min(Math.max(source.boost ?? 0, 0), 1);

      // A phase from the node's id, so that every flame is out of step with
      // the others.
      let phase = 0;
      for (const char of String(node.id)) {
        phase = (phase * 31 + char.charCodeAt(0)) % 1000;
      }

      // A harder burning flame flickers faster and harder.
      const t = (settings.time ?? 0) + seconds * speed * (1 + throttle + boost);
      const shake = flicker * (0.6 + 0.6 * throttle + 0.6 * boost);

      // It is also much longer, growing faster near full throttle, and wider.
      // A boost makes it bigger still.
      const length =
        (0.35 + 1.85 * Math.pow(throttle, 1.3)) *
        (1 + 2 * boost) *
        (1 + shake * noise(t, phase, 0));
      const width = (0.8 + 0.45 * throttle) * (1 + boost) * (1 + shake * 0.4 * noise(t, phase, 2));

      // And it burns hotter: the material color adds to the flame's vertex
      // colors, so adding warm white pushes it toward white-hot.
      const heat = throttle * throttle + 1.5 * boost;
      const [r, g, b, a] = color;

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          scale: [scale[0] * width, scale[1] * width, scale[2] * length],
        },
        material: {
          ...state.material,
          color: [r + 0.25 * heat, g + 0.25 * heat, b + 0.15 * heat, a],
        },
        script: {...state.script, settings: {...settings, scale, color, time: t}},
      });
    },
  };
};
