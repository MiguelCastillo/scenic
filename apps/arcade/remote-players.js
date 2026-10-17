import {replaceShip} from "./ships.js";

// The most messages a player's channel keeps until the scene pulls them:
// over 10 seconds' worth at 20 a second.
const maxMessages = 256;

// RemotePlayers puts the other players in a room into the scene this player
// is playing: each as a copy of the node that is this player in it, whatever
// it is, such as a ship or a snake, run by a script of the game's instead of
// the player's controls. The game's manifest names both: the node in
// "player", such as "starfighter", and the script in "multiplayer":
// {"remote": "scripts/remote-ship.js"}, relative to the scene file, like the
// scene's own. In a game with ships to choose from, each copy flies the ship
// its player chose, which comes with their messages.
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
// Its API: publishToScene(playerID, {scene, ship, message}), keep(otherPlayerIDs)
// and dispose(). Players are known by the ids the relay gives them, such as
// "p2" (see server/relay.go).
export class RemotePlayers {
  // scene is the loaded scene playing (see loadScene), and sceneFile its
  // file, such as "race.json".
  //
  // Options:
  // - playerNodeID: the id of the node that is this player in the scene,
  //   such as "starfighter", which the others' copies are copies of.
  // - remoteScript: the script the copies run.
  // - ships: the game's ships (see Ships), for a game with ships to choose
  //   from.
  constructor(scene, sceneFile, {playerNodeID, remoteScript, ships = null}) {
    this._scene = scene;
    this._sceneFile = sceneFile;
    this._playerNodeID = playerNodeID;
    this._remoteScript = remoteScript;
    this._ships = ships;
    // Each other player's copy, by the player's id, as {nodeID, removed}:
    // its node's id, once it is added, and whether it was taken out while
    // it was being added.
    this._copiesByPlayerID = new Map();
  }

  // publishToScene publishes a message another player sent from scene to
  // their copy in the scene playing, adding the copy if it is their first,
  // flying ship, if the game has ships.
  publishToScene(playerID, {scene, ship, message}) {
    if (scene !== this._sceneFile) {
      this._remove(playerID);
      return;
    }

    if (!this._copiesByPlayerID.has(playerID)) {
      const copy = {nodeID: null, removed: false};
      this._copiesByPlayerID.set(playerID, copy);
      this._add(playerID, copy, ship);
      // Messages pile up only so far while nothing pulls them, such as
      // while the page is in the background.
      this._scene.sceneManager.input.limit(playerID, maxMessages);
    }
    this._scene.sceneManager.input.publish(playerID, {type: "network", message});
  }

  // keep takes out the copies of the players who aren't in otherPlayerIDs,
  // the ids of the others still in the room.
  keep(otherPlayerIDs) {
    for (const playerID of this._copiesByPlayerID.keys()) {
      if (!otherPlayerIDs.includes(playerID)) {
        this._remove(playerID);
      }
    }
  }

  // dispose takes every other player's copy out of the scene.
  dispose() {
    for (const playerID of [...this._copiesByPlayerID.keys()]) {
      this._remove(playerID);
    }
  }

  async _add(playerID, copy, ship) {
    const {sceneManager} = this._scene;
    // A copy flying its own ship starts without this player's ship's parts.
    const fliesOwnShip = !!(this._ships && ship);
    // eslint-disable-next-line no-unused-vars
    const {id, collider, hud, network, items, ...look} = sceneManager.getNodeStateByID(
      this._playerNodeID
    );
    const config = {
      ...look,
      ...(!fliesOwnShip && {items}),
      input: playerID,
      script: {src: this._remoteScript},
    };

    // The copy's node id is only kept once the copy is whole, ship and all,
    // so that a player who leaves while it loads has it taken out after.
    let nodeID = null;
    try {
      nodeID = await this._scene.add(config, {
        parentID: sceneManager.getNodeByID(this._playerNodeID).parent.id,
        idPrefix: `${playerID} `,
      });
      if (fliesOwnShip) {
        await replaceShip(this._scene, nodeID, await this._ships.shipConfig(ship));
      }
    } catch (ex) {
      if (nodeID) {
        this._scene.remove(nodeID);
      }
      this._copiesByPlayerID.delete(playerID);
      throw ex;
    }

    copy.nodeID = nodeID;
    if (copy.removed) {
      this._scene.remove(copy.nodeID);
    }
  }

  _remove(playerID) {
    const copy = this._copiesByPlayerID.get(playerID);
    if (!copy) {
      return;
    }
    this._copiesByPlayerID.delete(playerID);
    if (copy.nodeID) {
      this._scene.remove(copy.nodeID);
    } else {
      copy.removed = true;
    }
  }
}
