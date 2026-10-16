// menu is a list of choices, such as a game's tracks, that the player picks
// from with the keyboard:
// - Up and down arrows: move to the choice above or below, going around from
//   one end to the other.
// - Enter or Space: pick the choice.
//
// Its settings come from "script.settings" in the node's config:
// - title: what the menu is, shown above the choices.
// - choices: the choices, as [{label, goTo}]: what the player sees, and
//   where picking it goes, such as the scene of a track, relative to the
//   menu's scene file.
// - hint: what to tell the player, such as which keys to press. Optional.
//
// Which choice is selected is written to its settings every frame, so a
// saved state picks up where it was, and so are the keys held, to tell when
// one is pressed rather than held:
// - selected: the selected choice, from 0. 0 by default.
// - held: the keys held down last frame, by KeyboardEvent.code.
//
// With "hud" in its node's state, such as {"hud": "menu"}, it tells the
// app's UI about the menu every frame, on that channel of sceneManager.ui
// (see SceneManager in @scenic/scene): {title, choices, selected, hint,
// picked}, with picked the choice picked this frame, {label, goTo}, or null.
// The app shows the menu and goes where a pick says.
module.exports = function createMenuScript(node) {
  return {
    update({keys = new Set(), sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings;
      const {title = "", choices = [], hint = ""} = settings;
      const held = new Set(settings.held || []);
      const pressed = (code) => keys.has(code) && !held.has(code);

      let selected = settings.selected ?? 0;
      if (choices.length) {
        if (pressed("ArrowDown")) {
          selected = (selected + 1) % choices.length;
        }
        if (pressed("ArrowUp")) {
          selected = (selected + choices.length - 1) % choices.length;
        }
      }
      const picked = pressed("Enter") || pressed("Space") ? choices[selected] : null;

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...settings, selected, held: [...keys]}},
      });

      if (state.hud) {
        sceneManager.ui.publish(state.hud, {title, choices, selected, hint, picked});
      }
    },
  };
};
