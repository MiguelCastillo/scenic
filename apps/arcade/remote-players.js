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
// The room's host also flies NPCs for everyone, in the seats no one has
// taken (see Lobby), whose messages come with the host's, as npcs: {name:
// {ship, label, message}}, by the NPC's name, such as "npc 1". Each of them
// has a copy too, the same as a player's.
//
// What the players send each other is the game's business: the arcade only
// carries it. A copy's messages are published to it on the scene's input, on
// a channel of its own, its player's id, such as "p2", or for an NPC, its
// host's id and its name, such as "p2/npc 1", which the copy's "input"
// names, as {type: "network", message} events, so its script gets them as
// the frame's `messages` (see SceneRunner in @scenic/runtime). Its script's
// settings have its name, as name, its ship's name, or the NPC's label, for
// the race's results.
//
// A copy's first message in the same scene adds it, beside this player's
// node. Players in another scene, or who left, have theirs taken out, and so
// do the NPCs their host no longer flies. Copies have the player's collider,
// so that this player's node bumps into them, and theirs into it on their
// own screens. A copy's channel keeps only so many messages until the scene
// pulls them, and drops the oldest, so that they don't pile up while the
// page is in the background.
//
// Its API: publishToScene(playerID, {scene, ship, message, npcs}),
// keep(otherPlayerIDs) and dispose(). Players are known by the ids the relay
// gives them, such as "p2" (see server/src/relay.js).
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
    // Each copy, by its channel, such as "p2" or "p2/npc 1", as {nodeID,
    // removed}: its node's id, once it is added, and whether it was taken
    // out while it was being added.
    this._copiesByChannel = new Map();
  }

  // publishToScene publishes a message another player sent from scene to
  // their copy in the scene playing, and those of the NPCs they fly, adding
  // each copy with its first message, flying its ship, if the game has
  // ships.
  publishToScene(playerID, {scene, ship, message, npcs = {}}) {
    if (scene !== this._sceneFile) {
      this._removeCopiesOf(playerID);
      return;
    }
    this._publish(playerID, {ship, message});
    for (const [name, npc] of Object.entries(npcs)) {
      this._publish(`${playerID}/${name}`, npc);
    }
    for (const channel of [...this._copiesByChannel.keys()]) {
      const [owner, npc] = channel.split("/");
      if (owner === playerID && npc && !npcs[npc]) {
        this._remove(channel);
      }
    }
  }

  // keep takes out the copies of the players who aren't in otherPlayerIDs,
  // the ids of the others still in the room, and of the NPCs they flew.
  keep(otherPlayerIDs) {
    for (const channel of [...this._copiesByChannel.keys()]) {
      if (!otherPlayerIDs.includes(channel.split("/")[0])) {
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

  // _publish publishes message to the copy on channel, adding it, flying
  // ship and called label, if it is its first. A copy whose game hasn't
  // said anything yet, such as before its first frame, has none until it
  // does.
  _publish(channel, {ship, label, message}) {
    if (message === undefined) {
      return;
    }
    if (!this._copiesByChannel.has(channel)) {
      const copy = {nodeID: null, removed: false};
      this._copiesByChannel.set(channel, copy);
      this._add(channel, copy, ship, label);
      // Messages pile up only so far while nothing pulls them, such as
      // while the page is in the background.
      this._scene.sceneManager.input.limit(channel, maxMessages);
    }
    this._scene.sceneManager.input.publish(channel, {type: "network", message});
  }

  _removeCopiesOf(playerID) {
    for (const channel of [...this._copiesByChannel.keys()]) {
      if (channel.split("/")[0] === playerID) {
        this._remove(channel);
      }
    }
  }

  async _add(channel, copy, ship, label) {
    const {sceneManager} = this._scene;
    // A copy flying its own ship starts without this player's ship's parts.
    const fliesOwnShip = !!(this._ships && ship);
    // The copy is this player's node without what makes it this player's:
    // its id, its HUD, its network channel, and how it is doing in the race.
    const {items, ...look} = sceneManager.getNodeStateByID(this._playerNodeID);
    for (const key of ["id", "hud", "held", "lap", "network"]) {
      delete look[key];
    }
    const name = label ?? (ship && this._ships?.find(ship)?.label) ?? "Player";
    const config = {
      ...look,
      ...(!fliesOwnShip && {items}),
      input: channel,
      script: {src: this._remoteScript, settings: {name}},
    };

    // The copy's node id is only kept once the copy is whole, ship and all,
    // so that a player who leaves while it loads has it taken out after.
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
