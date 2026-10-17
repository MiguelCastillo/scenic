// The most messages a player's channel keeps until the scene pulls them:
// over 10 seconds' worth at 20 a second.
const maxMessages = 256;

// RemotePlayers puts the other players in a room into the scene this player
// is playing: each as a copy of the node that is this player in it, whatever
// it is, such as a ship or a snake, run by a script of the game's instead of
// the player's controls. The game's manifest names both in "multiplayer":
// {"player": "starfighter", "remote": "scripts/remote-ship.js"}, the script
// relative to the scene file, like the scene's own.
//
// What the players send each other is the game's business: the arcade only
// carries it. A player's messages are published to their copy on the
// scene's input, on a channel of the player's own, such as "p2", which the
// copy's "input" names, as {type: "network", message} events, so its script
// gets them as the frame's `messages` (see SceneRunner in @scenic/runtime).
//
// A player's first message in the same scene adds their copy, beside this
// player's node. Players in another scene, or who left, have theirs taken
// out. Copies hit nothing: they have no collider. A player's channel keeps
// only so many messages until the scene pulls them, and drops the oldest,
// so that they don't pile up while the page is in the background.
//
// Its API: publishToScene(player, {scene, message}), keep(players) and
// dispose().
export class RemotePlayers {
  // scene is the loaded scene playing (see loadScene), sceneFile its file,
  // such as "race.json", and multiplayer the manifest's.
  constructor(scene, sceneFile, {player, remote}) {
    this._scene = scene;
    this._sceneFile = sceneFile;
    this._playerID = player;
    this._remoteScript = remote;
    // Each other player's copy, by the player's id, as {id, removed}: its
    // node's id, once it is added, and whether it was taken out while it
    // was being added.
    this._copiesByPlayer = new Map();
  }

  // publishToScene publishes a message another player sent from scene to
  // their copy in the scene playing, adding the copy if it is their first.
  publishToScene(player, {scene, message}) {
    if (scene !== this._sceneFile) {
      this._remove(player);
      return;
    }

    if (!this._copiesByPlayer.has(player)) {
      const copy = {id: null, removed: false};
      this._copiesByPlayer.set(player, copy);
      this._add(player, copy);
      // Messages pile up only so far while nothing pulls them, such as
      // while the page is in the background.
      this._scene.sceneManager.input.limit(player, maxMessages);
    }
    this._scene.sceneManager.input.publish(player, {type: "network", message});
  }

  // keep takes out the copies of the players who aren't in players, the ids
  // of the others still in the room.
  keep(players) {
    for (const player of this._copiesByPlayer.keys()) {
      if (!players.includes(player)) {
        this._remove(player);
      }
    }
  }

  // dispose takes every other player's copy out of the scene.
  dispose() {
    for (const player of [...this._copiesByPlayer.keys()]) {
      this._remove(player);
    }
  }

  async _add(player, copy) {
    const {sceneManager} = this._scene;
    // eslint-disable-next-line no-unused-vars
    const {id, collider, hud, network, ...look} = sceneManager.getNodeStateByID(this._playerID);
    const config = {...look, input: player, script: {src: this._remoteScript}};

    try {
      copy.id = await this._scene.add(config, {
        parentID: sceneManager.getNodeByID(this._playerID).parent.id,
        idPrefix: `${player} `,
      });
    } catch (ex) {
      this._copiesByPlayer.delete(player);
      throw ex;
    }

    if (copy.removed) {
      this._scene.remove(copy.id);
    }
  }

  _remove(player) {
    const copy = this._copiesByPlayer.get(player);
    if (!copy) {
      return;
    }
    this._copiesByPlayer.delete(player);
    if (copy.id) {
      this._scene.remove(copy.id);
    } else {
      copy.removed = true;
    }
  }
}
