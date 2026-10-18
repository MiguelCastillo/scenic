import {replaceShip} from "@scenic/racers";

// The most messages a ship's channel keeps until the scene pulls them: over
// 10 seconds' worth at 20 a second.
const maxMessages = 256;

// RemotePlayers shows a race the server runs (see server/src/room-race.js)
// in the scene this player is playing: every other racer's ship, people's
// and NPCs', where the server says it is. The player's own ship flies here
// (see arcade-main.js).
//
// The others are copies of the node that is the player in the scene, which
// the game's manifest names in "player", such as "starfighter", each run by
// the script the manifest names in "multiplayer": {"remote":
// "scripts/remote-ship.js"}, relative to the scene file, like the scene's
// own. In a game with ships to choose from, each copy flies the ship its
// racer flies.
//
// Where each ship is goes to its copy on the scene's input, as {type:
// "network", message} events, so its script gets them as the frame's
// `messages` (see SceneRunner in @scenic/runtime), on a channel of its own,
// its racer's on the server, such as "p2" or "npc 1", which the copy's
// "input" names.
//
// A racer's copy is added with the first snapshot it is in, beside the
// player's node, and taken out once it is no longer in one, such as an NPC
// whose seat a player took, or a player who left. A copy's channel keeps
// only so many messages until the scene pulls them, and drops the oldest, so
// that they don't pile up while the page is in the background.
//
// Its API: show(snapshot) and dispose().
export class RemotePlayers {
  // scene is the loaded scene playing (see loadScene).
  //
  // Options:
  // - playerNodeID: the id of the node that is this player in the scene,
  //   such as "starfighter", which the others' copies are copies of.
  // - remoteScript: the script the copies run.
  // - ships: the game's ships (see Ships), for a game with ships to choose
  //   from.
  constructor(scene, {playerNodeID, remoteScript, ships = null}) {
    this._scene = scene;
    this._playerNodeID = playerNodeID;
    this._remoteScript = remoteScript;
    this._ships = ships;
    // Each copy, by its channel, such as "p2" or "npc 1", as {nodeID,
    // removed}: its node's id, once it is added, and whether it was taken
    // out while it was being added.
    this._copiesByChannel = new Map();
  }

  // show puts a copy of every other racer's ship in the race the server
  // says, snapshot, {ships, you}, where it says (see RoomRace), other than
  // the player's own, you.
  show({ships, you}) {
    const {input} = this._scene.sceneManager;
    for (const [channel, where] of Object.entries(ships)) {
      if (channel === you?.name) {
        continue;
      }
      if (!this._copiesByChannel.has(channel)) {
        const copy = {nodeID: null, removed: false};
        this._copiesByChannel.set(channel, copy);
        this._add(channel, copy, where.ship);
        // Messages pile up only so far while nothing pulls them, such as
        // while the page is in the background.
        input.limit(channel, maxMessages);
      }
      input.publish(channel, {type: "network", message: where});
    }
    for (const channel of [...this._copiesByChannel.keys()]) {
      if (!ships[channel] || channel === you?.name) {
        this._remove(channel);
      }
    }
  }

  // dispose takes every copy out of the scene.
  dispose() {
    for (const channel of [...this._copiesByChannel.keys()]) {
      this._remove(channel);
    }
  }

  async _add(channel, copy, ship) {
    const {sceneManager} = this._scene;
    // A copy flying its own ship starts without this player's ship's parts.
    const fliesOwnShip = !!(this._ships && ship);
    // The copy is this player's node without what makes it this player's:
    // its id, its HUD, its network channel, and how it is doing in the race.
    const {items, ...look} = sceneManager.getNodeStateByID(this._playerNodeID);
    for (const key of ["id", "hud", "held", "lap", "network"]) {
      delete look[key];
    }
    const config = {
      ...look,
      ...(!fliesOwnShip && {items}),
      input: channel,
      script: {src: this._remoteScript},
    };

    // The copy's node id is only kept once the copy is whole, ship and all,
    // so that a racer who leaves while it loads has it taken out after.
    let nodeID = null;
    try {
      nodeID = await this._scene.add(config, {
        parentID: sceneManager.getNodeByID(this._playerNodeID).parent.id,
        idPrefix: `${channel} `,
      });
      if (fliesOwnShip) {
        await replaceShip(this._scene, nodeID, await this._ships.shipConfig(ship));
      }
    } catch (ex) {
      if (nodeID) {
        this._scene.remove(nodeID);
      }
      this._copiesByChannel.delete(channel);
      throw ex;
    }

    copy.nodeID = nodeID;
    if (copy.removed) {
      this._scene.remove(copy.nodeID);
    }
  }

  _remove(channel) {
    const copy = this._copiesByChannel.get(channel);
    if (!copy) {
      return;
    }
    this._copiesByChannel.delete(channel);
    if (copy.nodeID) {
      this._scene.remove(copy.nodeID);
    } else {
      copy.removed = true;
    }
  }
}
