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
  hangar.json        the hangar, choosing a ship
  ships.json         the ships to choose from
  ships/             each ship's parts, such as saucer.json
  menu.json          the pause menu, to resume, restart or leave a race
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
  behind it, on M, and whenever the game stops playing once it is under way,
  such as on Escape or the pause button on a touch screen. A race is under
  way once its countdown ends, and before that the arcade asks the player
  to click to join it, which starts the countdown. It shows what the menu
  publishes on its `menu` channel, and does what the picked choice says (see
  `resources/scripts/menu.js`): `goTo` loads that scene in the game's place,
  such as another track, `resume` closes the menu and plays the game,
  `restart` loads the game's scene again and plays it, and `leave` goes
  back to choosing a ship or a track. A choice with `"solo": true` shows
  only while racing alone, not with friends. Restarting a race the server
  runs waits for everyone racing it, like the first race (see
  `multiplayer`).
- `player`: the node that is the player in the game's scenes, such as
  `"starfighter"`, for choosing a ship and playing together.
- `ships` and `hangar`: the ships to choose from, and the scene to choose
  one in, optional. `ships` names a list of `{id, label, src}`: each ship's
  id, such as `"saucer"`, what players see, and its file, with the ship's
  parts, such as its body and flames, under a node of their own. After the
  track, the arcade opens the hangar, fills its menu with the ships, and
  shows the selected ship on its `showcase ship` node. Bubble Squadron's
  is a carousel, one ship at a time, turning slowly, changed with left and
  right, beside a list of its actions, Race solo, Race with friends and
  Back, chosen with up and down. Race with friends picks the ship with
  `"multiplayer": true` (see `with` in `resources/scripts/menu.js`), and
  asks which race to join, with Auto join, which puts the player in a race
  on the same track with a seat free, Join by code, to join a friend's
  race, on whatever track it is, and Start new race, whose code the lobby
  shows, to read out to friends (see `rooms` in `server/src/rooms.js`).
  Back, or Escape, goes back to the tracks. The chosen ship then replaces
  the parts of the `player` node in the track, and leaving the race comes
  back to the hangar.
- `multiplayer`: how the game's races are shown, optional, as
  `{"remote": "scripts/remote-ship.js"}`: the script that flies a ship
  where the server says. Every race, in the scenes `npcs` lists, runs on
  the server, in a room (see `RoomRace` in `server/src/room-race.js`): the
  server loads the scene with the game's own scripts, takes out the
  `player` node, and races copies of it, one for each player, on an input
  channel of its own, such as `"p2"`, which their keys go to, and one for
  each NPC. Each one publishes where it is on a network channel of the same
  name, such as fly.js does, which the server sends to everyone 20 times a
  second, with how the race is going. In the page, the `player` node runs
  the remote script instead of its own, flying where the server says, and
  publishing the keys the player holds on the channel its `network` names,
  for the arcade to send on, and every other racer is a copy of it, running
  the same script (see `RemotePlayers` in `apps/arcade`), with the `player`
  node's collider. The page's race follows the server's: the arcade
  publishes `{race, you}` every frame, as a network message on the scene's
  `room` input channel, which the race node reads by naming that channel
  in its `input` (see `race.js`).

  Everyone in a room starts together. Until the race starts, the arcade
  shows its lobby: the race's code, how many are ready, Start, which plays
  the game, the same as clicking it, and makes the player ready, and Leave
  race. The race starts once every player in the room is ready; someone
  who comes in during a race waits for the next one. The players stand on
  the starting grid in the order they joined the room. A race pauses while
  everyone racing it has paused, so a player racing alone can pause.

- `npcs`: racers the computer plays, optional, as `{"racers": 6, "pilot": "scripts/pilot.js", "scenes": ["race.json"]}`: the most racers in a race,
  people included, whose seats no one has taken NPCs fill, the script that
  flies them, and the scenes that are races, which the server runs (see
  `multiplayer`). Racing alone, that is 5 NPCs in a race of 6. The server
  fills every seat no one has taken with an NPC until the race starts,
  taking one out for each person who comes in, so that people always take
  an NPC's seat. Each NPC is a copy of the `player` node, on the starting
  grid behind the people, on an input channel of its own, such as
  `"npc 1"`, which its pilot presses keys on, the way a player's keyboard
  would, so it plays by the same rules (see `addRacer` in
  `@scenic/racers`). In a game with ships, each flies one of them, dealt
  at random.

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
