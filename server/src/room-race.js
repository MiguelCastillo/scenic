import {dealShips} from "@scenic/racers";

import {RaceRunner} from "./races.js";

// How many times a second the players hear how the race is going.
const snapshotsPerSecond = 20;

// RoomRace runs the races of a room, one after another, on its track (see
// RaceRunner), for the players in it: the server decides everything, and
// the players' browsers only send what they do and show what they hear.
//
// A player who joins before a race starts takes a seat in it, flying the
// ship they chose, and NPCs fill every seat no one takes, taking one out each
// time a player comes in, so players always take an NPC's seat. On the
// starting grid, the players stand first, in the order they joined, and the
// NPCs behind them. The race starts once every player in the room is ready.
// A player who joins once it has started waits for the next one.
//
// Each player says what they do, as often as they like, as {ship, ready,
// keys, race, seq}: the id of the ship they chose, whether they are ready to
// race, or once it has started, playing rather than paused, the keys they
// hold, such as ["Space", "ArrowLeft"], which go to their ship on its input
// channel as a keyboard's would, and the number of the race they want to
// race, to race again, and seq, which numbers what they say, for the
// answer to say which was the last it heard. Once every player racing wants
// a later race than this one, or no one is racing it, the next race loads,
// with everyone in it.
//
// Each player hears how the race is going, snapshotsPerSecond times a
// second, as {type: "race", number, you, started, lobby, race, ships}:
// - number: which race of the room's it is, from 1.
// - you: the player's racer, as {name, id, ack, ackAge, ship}, or null while
//   they aren't racing: its channel, such as "p2", its node's id in the
//   race, such as "p2 starfighter", the seq of the last thing the player
//   said before the race's last frame, how many milliseconds before it the
//   race heard it, and its ship's node state as of that frame, {transform, held, lap, settings}, so that the player's browser,
//   which flies its own ship from its keys too, can see how far off it is
//   (see fly.js).
// - started: whether the race has started, rather than waiting for its
//   players.
// - lobby: {players, ready}, how many players are in the room, and how many
//   of them are ready.
// - race: how the race is going (see race in RaceRunner).
// - ships: every racer's ship, by its channel, as {ship, label, position,
//   rotation, throttle, boost, booster}, the ship it flies, what it is
//   called, and where it is, as its script publishes it (see fly.js).
//
// Its API: load(gameURL, sceneFile), join(playerID, send), hear(playerID,
// message), leave(playerID), and dispose().
export class RoomRace {
  // load loads the room's first race, of sceneFile in the game at gameURL
  // (see load in RaceRunner).
  static async load(gameURL, sceneFile) {
    return new RoomRace(gameURL, sceneFile, await RaceRunner.load(gameURL, sceneFile));
  }

  constructor(gameURL, sceneFile, runner) {
    this._gameURL = gameURL;
    this._sceneFile = sceneFile;
    // Each player, by their id, in the order they joined: {id, send, ship,
    // ready, keys, wants, racer}, their id, how to send them a message, what
    // they last said (see RoomRace), and their racer, once they have one in
    // this race, with its place on the starting grid.
    this._playersByID = new Map();
    // The NPCs racing, with their places, and the ships to deal out to them.
    this._npcs = [];
    this._npcShips = dealShips(runner.ships);
    this._number = 1;
    this._started = false;
    // Whether a racer is being added or the next race loaded, which only
    // happens one at a time.
    this._busy = false;
    this._runner = runner;
    this._runner.start();
    this._timer = setInterval(() => this._tick(), 1000 / snapshotsPerSecond);
  }

  join(playerID, send) {
    this._playersByID.set(playerID, {
      id: playerID,
      send,
      ship: null,
      ready: false,
      keys: [],
      wants: 0,
      racer: null,
      heard: [],
    });
  }

  // hear keeps what playerID said they do, and presses and lets go of keys
  // on their racer's channel, as they did.
  hear(playerID, {ship = null, ready = false, keys = [], race = 0, seq = 0} = {}) {
    const player = this._playersByID.get(playerID);
    if (!player) {
      return;
    }
    const held = Array.isArray(keys) ? keys.filter((key) => typeof key === "string") : [];
    if (player.racer) {
      const {input} = this._runner.sceneManager;
      for (const code of held.filter((code) => !player.keys.includes(code))) {
        input.publish(player.racer.name, {type: "keydown", code});
      }
      for (const code of player.keys.filter((code) => !held.includes(code))) {
        input.publish(player.racer.name, {type: "keyup", code});
      }
    }
    Object.assign(player, {
      ship,
      ready: !!ready,
      keys: held,
      wants: Number(race) || 0,
    });
    player.heard.push({seq: Number(seq) || 0, at: performance.now()});
  }

  // leave takes playerID out of the room, and their racer out of the race.
  leave(playerID) {
    const player = this._playersByID.get(playerID);
    if (player?.racer) {
      this._runner.removeRacer(player.racer);
    }
    this._playersByID.delete(playerID);
  }

  dispose() {
    clearInterval(this._timer);
    this._runner.dispose();
  }

  // _tick fills the seats until the race starts, starts it once everyone is
  // ready, loads the next one once everyone wants it, and tells everyone how
  // it is going.
  _tick() {
    const players = [...this._playersByID.values()];
    const racing = players.filter(({racer}) => racer);
    if (!this._busy && !this._started) {
      this._fillSeats(players);
    }
    if (
      !this._busy &&
      !this._started &&
      players.length &&
      players.every(({racer, ready}) => racer && ready)
    ) {
      this._started = true;
      this._runner.waitForPlayers(false);
    }
    if (
      !this._busy &&
      this._started &&
      players.length &&
      racing.every(({wants}) => wants > this._number)
    ) {
      this._loadNextRace();
    }
    // A race that has started pauses while everyone racing it has paused,
    // which they say by no longer being ready, such as a player alone
    // opening the menu.
    this._runner.pause(this._started && racing.length > 0 && racing.every(({ready}) => !ready));
    this._sendSnapshots(players);
  }

  // _fillSeats seats the players who haven't a racer yet, one at a time,
  // taking an NPC out for each, fills the seats left with NPCs, and lines
  // everyone up on the starting grid.
  _fillSeats(players) {
    const runner = this._runner;
    const seated = players.filter(({racer}) => racer);
    const unseated = players.filter(({racer, ship}) => !racer && ship !== null);
    if (unseated.length && seated.length + this._npcs.length >= runner.seats && this._npcs.length) {
      runner.removeRacer(this._npcs.pop());
    } else if (unseated.length && seated.length < runner.seats) {
      // A player's keys go to their racer from when it is in the race, so
      // the keys they already hold are pressed with what they say next.
      const [player] = unseated;
      const ship = runner.ships?.find(player.ship) ? player.ship : null;
      const label = runner.ships?.find(ship)?.label ?? "Player";
      const place = seated.length;
      this._add(runner.addRacer({name: player.id, label, place, ship}), (racer) => {
        if (this._playersByID.get(player.id) === player) {
          Object.assign(player, {racer: {...racer, place}, keys: []});
        } else {
          runner.removeRacer(racer);
        }
      });
    } else if (seated.length + this._npcs.length < runner.seats) {
      const number = Math.max(0, ...this._npcs.map(({name}) => Number(name.slice(4)))) + 1;
      const ships = this._npcShips;
      const ship = ships.length ? ships[(number - 1) % ships.length] : null;
      const place = seated.length + this._npcs.length;
      this._add(
        runner.addRacer({
          name: `npc ${number}`,
          label: ship?.label ?? `NPC ${number}`,
          place,
          ship: ship?.id ?? null,
          pilot: true,
          skill: 0.5 + (0.45 * ((number - 1) % 5)) / 4,
        }),
        (npc) => this._npcs.push({...npc, place})
      );
    }

    const lineUp = (racer, place) => {
      if (racer.place !== place) {
        runner.moveRacer(racer, place);
        racer.place = place;
      }
    };
    seated.forEach(({racer}, place) => lineUp(racer, place));
    this._npcs.forEach((npc, i) => lineUp(npc, seated.length + i));
  }

  // _add waits for a racer being added, and then gives it to done, unless
  // the race it was added to has been replaced since.
  _add(adding, done) {
    const runner = this._runner;
    this._busy = true;
    adding
      .then((racer) => runner === this._runner && done(racer))
      .catch((error) => console.error("adding a racer:", error))
      .finally(() => (this._busy = false));
  }

  // _loadNextRace loads the next race on the same track, with everyone's
  // seats to fill again, and drops this one.
  _loadNextRace() {
    this._busy = true;
    RaceRunner.load(this._gameURL, this._sceneFile)
      .then((runner) => {
        this._runner.dispose();
        this._runner = runner;
        this._runner.start();
        this._number += 1;
        this._started = false;
        this._npcs = [];
        this._npcShips = dealShips(runner.ships);
        for (const player of this._playersByID.values()) {
          player.racer = null;
        }
      })
      .catch((error) => console.error("loading the next race:", error))
      .finally(() => (this._busy = false));
  }

  _sendSnapshots(players) {
    const {network} = this._runner.sceneManager;
    const racers = [...players.map(({racer}) => racer).filter(Boolean), ...this._npcs];
    const ships = Object.fromEntries(
      racers.map(({name, ship, label}) => [name, {ship, label, ...network.latest(name)}])
    );
    const snapshot = {
      type: "race",
      number: this._number,
      started: this._started,
      lobby: {players: players.length, ready: players.filter(({ready}) => ready).length},
      race: this._runner.race(),
      ships,
    };
    // What a player's ship is doing is as of the race's last frame, which
    // what they said before it went into: the last of that is the one this
    // answers, and the others before it are done with.
    const {sceneManager, frameAt} = this._runner;
    for (const player of players) {
      const {send, racer, heard} = player;
      const applied = heard.findLastIndex(({at}) => at <= frameAt);
      const ack = heard[applied];
      player.heard = heard.slice(Math.max(0, applied));
      const state = ack && racer && sceneManager.getNodeStateByID(racer.shipNodeID);
      send({
        ...snapshot,
        you: state && {
          name: racer.name,
          id: racer.shipNodeID,
          ack: ack.seq,
          ackAge: frameAt - ack.at,
          ship: {
            transform: state.transform,
            held: !!state.held,
            lap: state.lap ?? 0,
            settings: state.script.settings,
          },
        },
      });
    }
  }
}
