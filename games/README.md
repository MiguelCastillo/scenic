# Games

Each folder here is a game: everything it needs to run, other than the engine
and what is shared in `resources/`. A game is played in the arcade app,
and its scenes can be opened in the editor to build and test them.

```
games/bubble-squadron/
  game.json          the manifest
  race.json          a scene
  highway.json       another scene
  welcome.json       the welcome page, choosing a track
  menu.json          the pause menu, to resume or leave a race
  starfighters.json  another scene
  scripts/           the scripts only its scenes run, such as remote-ship.js
```

`game.json` describes the game:

- `name`: the game's name, as players see it.
- `description`: a sentence about it.
- `scene`: the scene the game starts in, relative to the folder.
- `scenes`: every scene in the game, for apps that list them.
- `welcome`: the game's welcome scene, optional. The arcade opens the game
  on it, alone, to choose the track to play: picking a choice in its menu
  (see `resources/scripts/menu.js`) loads that scene as the game. Without
  one, the game opens on `scene`, with its menu over it.
- `menu`: the game's menu scene, optional. The arcade opens it stacked over
  the game (see `SceneStack` in `@scenic/runtime`), with the game paused
  behind it, on M, or the pause button on a touch screen, and Escape closes
  it. It shows what the menu publishes on its `menu` channel, and does what
  the picked choice says (see `resources/scripts/menu.js`): `goTo` loads that
  scene in the game's place, such as another track, `resume` closes the
  menu, and `leave` goes back to the welcome scene.
- `multiplayer`: how the game is played together in a room, optional, as
  `{"player": "starfighter", "remote": "scripts/remote-ship.js"}`: the node
  that is the player in its scenes, whose script publishes what the others
  need to know on the channel its `network` names, and the script the
  copies of the other players run, which gets their messages (see
  `RemotePlayers` in `apps/arcade`).

A game never reads anything from `apps/`: its scenes and scripts use only
what is in its own folder, what is shared in `resources/`, and the `@scenic`
modules the runtime gives scripts. Apps run games, but a game doesn't depend
on any app, so every app can run it. What games and apps both use goes in
`resources/`: models in `resources/obj`, and scripts that aren't about one
game, such as `hover.js`, `flame.js` and `spin.js`, in `resources/scripts`.

A scene's script paths, such as `"src": "scripts/fly.js"`, are relative to
the scene file (see `loadScene` in `@scenic/runtime`), so a game's scenes
find their scripts in any app that runs them. Shared models and scripts are
loaded by absolute path, such as `/resources/scripts/hover.js`.

The editor lists the games' scenes alongside its own, in `sceneFiles` in
`apps/editor/app-main.jsx`.
