import {WebSocketServer} from "ws";

// The longest message a player can send, in bytes.
const maxMessageSize = 64 * 1024;
// The longest room name, in bytes.
const maxRoomNameSize = 64;
// How many bytes can wait to be written to a player before the newest
// messages are dropped, rather than holding up the room.
const maxBufferedBytes = 1024 * 1024;
// How long a room is kept empty when emptyRoomMs isn't given.
const defaultEmptyRoomMs = 2 * 60 * 1000;
// The letters room codes are made of: capitals, without I and O, which look
// like 1 and 0.
const codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ";

// Relay keeps the rooms players race in: who is in each one, and its race,
// which the server runs (see RoomRace), and which each player in the room
// tells what they do and hears from.
//
// A player joins a room by connecting to /ws?room=name with a WebSocket.
// Every message is JSON, and everything about who is in the room comes from
// the relay:
//
// From a player:
//   - {"type": "player", ...}: what the player does, for the room's race
//     (see hear in RoomRace). It is from the player who sent it, whatever
//     it says, so that a player can't speak for another.
//
// To a player:
//   - {"type": "welcome", "yourID": "p1", "otherPlayerIDs": ["p2"]}: the
//     player's id, and the ids of the others already in the room, when the
//     player joins.
//   - {"type": "joined", "playerID": "p3"}: someone joined the room.
//   - {"type": "left", "playerID": "p2"}: someone left the room.
//   - {"type": "race", ...}: how the room's race is going (see RoomRace).
//   - {"type": "full"}: the room already has maxPlayers players, so the
//     player can't join it, and the connection closes.
//
// Players are given ids in the order they join, "p1", "p2" and so on.
//
// A room exists while it has players in it, and for emptyRoomMs after the
// last one leaves, so that a room made for a race (see roomFor) is still
// there for its players to come back to, such as when they reload the page.
// A room made for a race has the game and the scene it is for, such as
// "bubble-squadron" and "race.json", and whether anyone can be put in it by
// auto join (public), rather than only those who know its code. Its race
// starts when its first player joins, with startRace, and stops when the
// last one leaves. A player that can't keep up with the messages to it
// misses some, rather than holding up the room.
//
// Options:
// - originPatterns: the hosts of the pages allowed to connect, such as
//   "localhost:*", or "*" for any host. A page from the server's own host
//   can always connect. The relay holds nothing private, so letting pages
//   anywhere connect, such as on a tablet on the same network, only lets
//   them join rooms. ["*"] by default.
// - maxPlayers: the most players a room can have at once, or 0 for no
//   limit. 0 by default.
// - emptyRoomMs: how long a room is kept after the last player leaves it,
//   or before the first one joins, in milliseconds. 2 minutes by default.
// - startRace: (game, scene) => a promise of a room's race, such as a
//   RoomRace, with join(playerID, send), hear(playerID, message),
//   leave(playerID) and dispose(), or null for rooms without races, such as
//   in tests of the rooms alone. null by default.
//
// Its API: handleUpgrade(request, socket, head), for an HTTP server's
// "upgrade" event, and roomFor(game, scene, auto) and roomInfo(code), for
// making and finding races (see rooms.js).
export class Relay {
  constructor({
    originPatterns = ["*"],
    maxPlayers = 0,
    emptyRoomMs = defaultEmptyRoomMs,
    startRace = null,
  } = {}) {
    this.originPatterns = originPatterns;
    this.maxPlayers = maxPlayers;
    this.emptyRoomMs = emptyRoomMs;
    this._startRace = startRace;
    // The rooms, by name: {playersByID, game, scene, public, emptySince,
    // race}, with playersByID each player's socket by their id, and race a
    // promise of its race while it has players, which is null if it has
    // none, or it failed to start.
    this._roomsByName = new Map();
    this._lastID = 0;
    this._sockets = new WebSocketServer({noServer: true, maxPayload: maxMessageSize});
  }

  // handleUpgrade joins the player connecting with request to the room its
  // URL names, or turns them away: a room without a name, or one too long,
  // is a bad request, and a page from a host originPatterns don't allow is
  // forbidden.
  handleUpgrade(request, socket, head) {
    const url = new URL(request.url, "http://localhost");
    const name = url.searchParams.get("room") ?? "";
    if (!name || Buffer.byteLength(name) > maxRoomNameSize) {
      return refuse(socket, 400, `room must be 1 to ${maxRoomNameSize} bytes`);
    }
    if (!this._allowsOrigin(request)) {
      return refuse(socket, 403, "this page can't join rooms");
    }
    this._sockets.handleUpgrade(request, socket, head, (ws) => this._join(name, ws));
  }

  // roomFor is the code of a room for a race of game's scene: to auto join,
  // the fullest public one with a seat free, or else a new room, public to
  // auto join, and only for those who know its code otherwise.
  roomFor(game, scene, auto) {
    this._forgetEmptyRooms();
    if (auto) {
      let best = null;
      for (const [code, room] of this._roomsByName) {
        const fits = room.public && room.game === game && room.scene === scene;
        if (fits && !this._isFull(room) && (!best || room.playersByID.size > best.players)) {
          best = {code, players: room.playersByID.size};
        }
      }
      if (best) {
        return best.code;
      }
    }

    const code = this._newCode();
    Object.assign(this._addRoom(code), {game, scene, public: auto});
    return code;
  }

  // roomInfo is what there is to know about the room with code: {code, game,
  // scene, players, full}, what its race is, how many are in it, and
  // whether it has no seat free, or null when there is no such room.
  roomInfo(code) {
    this._forgetEmptyRooms();
    const room = this._roomsByName.get(code);
    if (!room) {
      return null;
    }
    return {
      code,
      game: room.game,
      scene: room.scene,
      players: room.playersByID.size,
      full: this._isFull(room),
    };
  }

  // _join adds the player on ws to the room called name, making the room if
  // it is new, or turns them away if it is full. The player is welcomed with
  // the ids of the others already there before any other message, and the
  // others are told about them. Their messages go to the others until they
  // leave.
  _join(name, ws) {
    this._forgetEmptyRooms();
    const room = this._roomsByName.get(name) ?? this._addRoom(name);
    if (this._isFull(room)) {
      ws.send(JSON.stringify({type: "full"}));
      ws.close(1008, "the room is full");
      return;
    }

    const id = `p${++this._lastID}`;
    const otherPlayerIDs = [...room.playersByID.keys()];
    for (const other of room.playersByID.values()) {
      send(other, {type: "joined", playerID: id});
    }
    send(ws, {type: "welcome", yourID: id, otherPlayerIDs});
    room.playersByID.set(id, ws);
    if (room.game && this._startRace && !room.race) {
      room.race = this._startRace(room.game, room.scene).catch((error) => {
        console.error(`starting the race in room ${name}:`, error);
        return null;
      });
    }
    room.race?.then((race) => race?.join(id, (message) => send(ws, message)));

    ws.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message?.type === "player") {
        room.race?.then((race) => race?.hear(id, message));
      }
    });
    ws.on("close", () => this._leave(room, id));
  }

  // _leave takes the player out of the room and tells the others. A room
  // left empty is forgotten once it has been empty for emptyRoomMs.
  _leave(room, id) {
    room.playersByID.delete(id);
    room.race?.then((race) => race?.leave(id));
    if (!room.playersByID.size) {
      room.race?.then((race) => race?.dispose());
      room.race = null;
      room.emptySince = Date.now();
      return;
    }
    for (const other of room.playersByID.values()) {
      send(other, {type: "left", playerID: id});
    }
  }

  _addRoom(name) {
    const room = {
      playersByID: new Map(),
      game: "",
      scene: "",
      public: false,
      emptySince: Date.now(),
      race: null,
    };
    this._roomsByName.set(name, room);
    return room;
  }

  // _forgetEmptyRooms forgets the rooms that have been empty for
  // emptyRoomMs.
  _forgetEmptyRooms() {
    const now = Date.now();
    for (const [name, room] of this._roomsByName) {
      if (!room.playersByID.size && now - room.emptySince >= this.emptyRoomMs) {
        this._roomsByName.delete(name);
      }
    }
  }

  // _newCode is a code no room has.
  _newCode() {
    for (;;) {
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += codeLetters[Math.floor(Math.random() * codeLetters.length)];
      }
      if (!this._roomsByName.has(code)) {
        return code;
      }
    }
  }

  _isFull(room) {
    return this.maxPlayers > 0 && room.playersByID.size >= this.maxPlayers;
  }

  // _allowsOrigin is whether the page connecting with request may: one from
  // the server's own host, or one whose host matches an origin pattern,
  // where * matches anything.
  _allowsOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) {
      return true;
    }
    let host;
    try {
      host = new URL(origin).host.toLowerCase();
    } catch {
      return false;
    }
    if (host === request.headers.host?.toLowerCase()) {
      return true;
    }
    return this.originPatterns.some((pattern) => {
      const escaped = pattern.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`).test(host);
    });
  }
}

// send sends message to the player on ws, or drops it if the player is too
// far behind, or gone.
function send(ws, message) {
  if (ws.readyState === ws.OPEN && ws.bufferedAmount < maxBufferedBytes) {
    ws.send(JSON.stringify(message));
  }
}

// refuse answers a connection that can't become a WebSocket with status and
// why, and closes it.
function refuse(socket, status, why) {
  socket.end(
    `HTTP/1.1 ${status} ${status === 400 ? "Bad Request" : "Forbidden"}\r\n` +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${Buffer.byteLength(why)}\r\n` +
      "Connection: close\r\n\r\n" +
      why
  );
}
