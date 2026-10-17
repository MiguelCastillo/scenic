// menu is a list of choices, such as a game's tracks, that the player picks
// from with the menu intents in its input, whatever device they used (see
// input-intents.js in @scenic/dom): navigate moves to the choice above or
// below, going around from one end to the other, choose picks a choice
// directly, such as by tapping it, select picks the one it is on, and back
// leaves the menu.
//
// Its settings come from "script.settings" in the node's config:
// - title: what the menu is, shown above the choices.
// - choices: the choices, as [{label, goTo}]: what the player sees, and
//   where picking it goes, such as the scene of a track, relative to the
//   menu's scene file. A choice can say anything else the app understands
//   instead of goTo, such as {"label": "Resume", "resume": true}, which the
//   arcade gets as is when it is picked.
// - hint: what to tell the player, such as which keys to press. Optional.
//
// Which choice is selected is written to its settings every frame, so a
// saved state picks up where it was:
// - selected: the selected choice, from 0. 0 by default.
//
// With "hud" in its node's state, such as {"hud": "menu"}, it tells the
// app's UI about the menu every frame, on that channel of sceneManager.ui
// (see SceneManager in @scenic/scene): {title, choices, selected, hint,
// picked, back}, with picked the choice picked this frame, {label, goTo}, or
// null, and back whether the player left the menu this frame. The app shows
// the menu, goes where a pick says, and closes it on back.
module.exports = function createMenuScript(node) {
  return {
    update({intents, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings;
      const {title = "", choices = [], hint = ""} = settings;
      const {navigate, choose, select, back} = intents;

      let selected = settings.selected ?? 0;
      if (choices.length) {
        selected = (((selected + navigate.y) % choices.length) + choices.length) % choices.length;
        if (choose != null && choices[choose]) {
          selected = choose;
        }
      }
      const picked = choose != null || select ? choices[selected] ?? null : null;

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...settings, selected}},
      });

      if (state.hud) {
        sceneManager.ui.publish(state.hud, {title, choices, selected, hint, picked, back});
      }
    },
  };
};
