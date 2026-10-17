// The statuses of a player in a room's lobby: how far they are toward the
// next race on the scene they are in.

// waiting is in the scene, but not playing yet, such as before clicking to
// join the race.
export const waiting = "waiting";

// ready is playing, and waiting for the others to be ready too.
export const ready = "ready";

// racing is in a race that has started, until they leave it or race again.
export const racing = "racing";

// Lobby is where the players in a room get together before a race: it keeps
// the scene each of the others is in and their status, as they last said
// (see hear), so that this player's game knows when everyone in its scene is
// ready to start, and where on the starting grid it stands.
//
// A race starts once everyone in the scene is ready (see startsNow). Anyone
// still racing in the scene, such as in the last race, holds it up until
// they come back to race again, so that someone who joins during a race
// waits for the next one.
//
// Someone in the room this player hasn't heard from yet, such as while their
// game loads, counts as waiting in every scene, so that a race never starts
// without them: a room is for one race, on one track, which they are coming
// to.
//
// Players are known by the ids the relay gives them, such as "p2", which it
// numbers in the order they join (see server/relay.go), so the player who
// joined first comes first.
//
// The player who joined the room first is its host, who fills the seats no
// one has taken with NPCs, and flies them for everyone (see isHost).
//
// Its API: hear(playerID, {scene, status}), keep(otherPlayerIDs),
// startsNow({scene, status}), place(yourID, scene), count({scene, status})
// and isHost(yourID).
export class Lobby {
  constructor() {
    // Each other player's scene and status, by their id, as {scene, status}.
    this._byPlayerID = new Map();
  }

  // hear keeps what another player said about where they are.
  hear(playerID, {scene, status}) {
    this._byPlayerID.set(playerID, {scene, status});
  }

  // keep keeps the players in otherPlayerIDs, the ids of the others in the
  // room, and forgets the rest. Those not heard from yet are waiting, in no
  // scene yet.
  keep(otherPlayerIDs) {
    for (const playerID of [...this._byPlayerID.keys()]) {
      if (!otherPlayerIDs.includes(playerID)) {
        this._byPlayerID.delete(playerID);
      }
    }
    for (const playerID of otherPlayerIDs) {
      if (!this._byPlayerID.has(playerID)) {
        this._byPlayerID.set(playerID, {scene: null, status: waiting});
      }
    }
  }

  // startsNow is whether this player's race starts: they are ready, and so
  // is everyone else in their scene.
  startsNow({scene, status}) {
    return status === ready && this._others(scene).every((other) => other.status === ready);
  }

  // place is this player's place on the starting grid of scene, from 0,
  // among the players there who aren't racing, in the order they joined.
  place(yourID, scene) {
    const players = [
      yourID,
      ...this._others(scene)
        .filter((other) => other.status !== racing)
        .map(({playerID}) => playerID),
    ];
    return players.sort((a, b) => joinOrder(a) - joinOrder(b)).indexOf(yourID);
  }

  // count is how many players are in scene, this one included, how many of
  // them are ready, and how many of the others are still racing, as
  // {players, ready, racing}.
  count({scene, status}) {
    const others = this._others(scene);
    return {
      players: others.length + 1,
      ready: others.filter((other) => other.status === ready).length + (status === ready ? 1 : 0),
      racing: others.filter((other) => other.status === racing).length,
    };
  }

  // isHost is whether this player is the room's host: the one in it who
  // joined first.
  isHost(yourID) {
    return [...this._byPlayerID.keys()].every(
      (playerID) => joinOrder(yourID) < joinOrder(playerID)
    );
  }

  // _others are the other players in scene, and those not heard from yet,
  // as [{playerID, status}].
  _others(scene) {
    return [...this._byPlayerID]
      .filter(([, other]) => other.scene === scene || other.scene === null)
      .map(([playerID, {status}]) => ({playerID, status}));
  }
}

// joinOrder is the number the relay gave a player when they joined, from
// their id, such as 2 for "p2".
const joinOrder = (playerID) => Number(playerID.slice(1));
