// menu is a list of choices, such as a game's tracks, that the player picks
// from with the menu intents in its input, whatever device they used (see
// input-intents.js in @scenic/dom): navigate moves to the choice above or
// below, going around from one end to the other, choose picks a choice
// directly, such as by tapping it, select picks the one it is on, and back
// leaves the menu.
//
// As a carousel, it shows its choices one at a time, such as ships to look
// at, beside a list of actions to take on the one shown, such as Race and
// Back. Left and right move through the choices, up and down through the
// actions, and select takes the selected action, or act takes one directly.
//
// Its settings come from "script.settings" in the node's config:
// - title: what the menu is, shown above the choices.
// - choices: the choices, as [{label, goTo}]: what the player sees, and
//   where picking it goes, such as the scene of a track, relative to the
//   menu's scene file. A choice can say anything else the app understands
//   instead of goTo, such as {"label": "Resume", "resume": true}, which the
//   arcade gets as is when it is picked. A choice can have a picture too,
//   such as a track's, as its image, relative to the menu's scene file,
//   which a carousel shows.
// - hint: what to tell the player, such as which keys to press. Optional.
// - layout: how the choices are laid out: "list", one above the other, or
//   "carousel", one at a time. "list" by default.
// - actions: a carousel's actions, as [{label, pick}] to pick the choice
//   shown, and [{label, back}] to leave the menu. Pick, then Back, by
//   default. An action that picks can add to the pick with "with", such as
//   {"label": "Race with friends", "pick": true, "with": {"multiplayer":
//   true}}, which picks the choice shown with multiplayer: true.
//
// Which choice and action are selected is written to its settings every
// frame, so a saved state picks up where it was:
// - selected: the selected choice, from 0. 0 by default.
// - action: a carousel's selected action, from 0. 0 by default.
//
// With "hud" in its node's state, such as {"hud": "menu"}, it tells the
// app's UI about the menu every frame, on that channel of sceneManager.ui
// (see SceneManager in @scenic/scene): {title, choices, selected, hint,
// layout, actions, action, picked, back}, with picked the choice picked this
// frame, {label, goTo}, with what its action adds, or null, and back whether the player left the menu
// this frame. The app shows the menu as its layout says, goes where a pick
// says, and closes it on back.

const defaultActions = [
  {label: "Pick", pick: true},
  {label: "Back", back: true},
];

// around is index moved by step, going around from one end of a list of
// length to the other.
const around = (index, step, length) => (((index + step) % length) + length) % length;

module.exports = function createMenuScript(node) {
  return {
    update({intents, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings;
      const {
        title = "",
        choices = [],
        hint = "",
        layout = "list",
        actions = defaultActions,
      } = settings;
      const {navigate, choose, act, select} = intents;
      const carousel = layout === "carousel";

      let selected = settings.selected ?? 0;
      if (choices.length) {
        selected = around(selected, carousel ? navigate.x : navigate.y, choices.length);
        if (choose != null && choices[choose]) {
          selected = choose;
        }
      }
      let action = settings.action ?? 0;
      if (carousel && actions.length) {
        action = around(action, navigate.y, actions.length);
        if (act != null && actions[act]) {
          action = act;
        }
      }

      // A list picks the selected choice on select. A carousel takes its
      // selected action, which picks the choice shown or leaves.
      const takes = carousel && (select || act != null) ? actions[action] ?? {} : {};
      const picks = choose != null || (select && !carousel) || !!takes.pick;
      const picked = picks && choices[selected] ? {...choices[selected], ...takes.with} : null;
      const back = intents.back || !!takes.back;

      sceneManager.updateNodeStateByID(node.id, {
        script: {...state.script, settings: {...settings, selected, action}},
      });

      if (state.hud) {
        sceneManager.ui.publish(state.hud, {
          title,
          choices,
          selected,
          hint,
          layout,
          actions,
          action,
          picked,
          back,
        });
      }
    },
  };
};
