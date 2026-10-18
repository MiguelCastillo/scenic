// How long to wait before trying to join the room again after the
// connection goes down: the first wait, which doubles after each try that
// fails, up to the longest.
const minRetryDelayMs = 500;
const maxRetryDelayMs = 5000;
// How many times in a row to try to join the room again before giving up,
// about a minute and a half of tries.
const maxRetries = 20;

// The statuses of a RoomConnection: how its connection to the room is doing,
// which also says whether it will join the room again on its own.

// connecting is joining the room, or trying to join it again after the
// connection dropped, such as when the server restarts. It tries again right
// away at first, then waits longer after each try that fails, up to
// maxRetryDelayMs, for up to maxRetries tries in a row, and is disconnected
// once they run out.
export const connecting = "connecting";

// connected is in the room: sending and hearing messages. When the
// connection drops, it is connecting again.
export const connected = "connected";

// disconnected is out of the room, and not trying to get back in: close was
// called, the tries to join again ran out, or the server turned the player
// away (see turnedAway). Only connect joins again. This is what tells a
// connection that dropped, and joins again on its own, from one that won't.
export const disconnected = "disconnected";

// RoomConnection joins a room on the relay, at /ws on the server the page
// came from (see server/src/relay.js), whose race the server runs (see
// server/src/room-race.js): the player tells it what they do with send, and
// hears how the race is going, so that players who join the same room race
// together, and a player alone races in a room of their own.
//
// It joins the room expecting its race, {game, scene}, such as
// "bubble-squadron" and "race.json", from the page's version, if it has one,
// such as the fingerprint of the arcade's bundle, so that joining again,
// such as after the server restarted, finds out whether the room is still
// that race, and the page still the one the server serves.
//
// Players are known by the ids the relay gives them, such as "p2". onChange
// is called with {status, yourID, otherPlayerIDs, turnedAway} whenever any
// of them changes, and onRace with every message about the race, {type:
// "race", ...}, which says what is in it. turnedAway is why the server
// turned the player away, or ended their room, which joining again won't
// change, as {reason, errorID}, with errorID the id the server logged it
// with, such as "7F3K-Q2MD", or null. The reasons:
// - "full": the room has no seat free.
// - "restarted": the server restarted since the player joined, and forgot
//   their room.
// - "gone": the room isn't the race any more, without the server having
//   restarted since the player joined, such as when it was forgotten while
//   no one was in it, or the player never joined it.
// - "outdated": the page is older than the one the server serves, and needs
//   to load again.
// - "closing": the server shut down, such as to restart, ending the race.
//
// status is how the connection is doing: connecting, connected or
// disconnected (see each).
//
// There are two connections here, one on top of the other: the socket's, to
// the server, and the player's place in the room, which the relay keeps.
// The socket can be open before the player is in the room, so connected
// means in the room, once the relay has welcomed the player, not just that
// the socket is open. The socket's close and the relay's messages, such as a
// welcome or someone joining, both change the room connection, so onChange
// is called from both.
//
// It forgets who was in the room as soon as the connection goes down, since
// joining again starts over, with new ids for everyone: the relay gives ids
// afresh when it restarts. Messages sent while it isn't connected are
// dropped.
//
// Its API: connect(), send(message), close(), status, yourID,
// otherPlayerIDs and turnedAway.
export class RoomConnection {
  constructor(room, {game, scene, version = null, onChange = () => {}, onRace = () => {}}) {
    this.status = disconnected;
    this.yourID = null;
    this.otherPlayerIDs = new Set();
    this.turnedAway = null;

    this._url = new URL("/ws", location.href);
    this._url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this._url.searchParams.set("room", room);
    this._url.searchParams.set("game", game);
    this._url.searchParams.set("scene", scene);
    if (version) {
      this._url.searchParams.set("version", version);
    }
    this._onChange = onChange;
    this._onRace = onRace;
    // How many times in a row it has tried to join again, how long to wait
    // before the next try, and the timer waiting for it.
    this._retries = 0;
    this._retryDelayMs = 0;
    this._retryTimer = null;
    // When the server started, as of when the player last joined, to tell
    // whether it has restarted since.
    this._serverStartedAt = null;
    this.connect();
  }

  // connect joins the room, unless it is already connected or connecting.
  connect() {
    if (this.status !== disconnected) {
      return;
    }
    this._retries = 0;
    this._retryDelayMs = 0;
    this.turnedAway = null;
    this.status = connecting;
    this._reportRoomConnection();
    this._openConnection();
  }

  // send tells the room's race what the player does, such as {ship, ready,
  // keys, race} (see hear in RoomRace).
  send(message) {
    if (this.status === connected) {
      this._socket.send(JSON.stringify({...message, type: "player"}));
    }
  }

  // close leaves the room: the connection goes down, and it isn't joined
  // again until connect is called.
  close() {
    // Stop listening to the socket before closing it, so that its close
    // isn't taken for a dropped connection to join again.
    this._socket.onclose = null;
    this._socket.onmessage = null;
    this._socket.close();
    clearTimeout(this._retryTimer);
    this.status = disconnected;
    this.otherPlayerIDs.clear();
    this._reportRoomConnection();
  }

  _openConnection() {
    this._socket = new WebSocket(this._url);

    // The connection dropped, since close stops listening before it closes
    // the socket: try to join again, unless the tries ran out, or the server
    // turned the player away, which trying again won't change.
    this._socket.onclose = () => {
      this.otherPlayerIDs.clear();
      if (!this.turnedAway && this._retries < maxRetries) {
        this.status = connecting;
        this._retryTimer = setTimeout(() => this._openConnection(), this._retryDelayMs);
        this._retries++;
        this._retryDelayMs = Math.min(
          Math.max(this._retryDelayMs * 2, minRetryDelayMs),
          maxRetryDelayMs
        );
      } else {
        this.status = disconnected;
      }
      this._reportRoomConnection();
    };
    this._socket.onmessage = (evt) => {
      const message = JSON.parse(evt.data);
      switch (message.type) {
        case "welcome":
          this._retries = 0;
          this._retryDelayMs = 0;
          this.status = connected;
          this.yourID = message.yourID;
          this.otherPlayerIDs = new Set(message.otherPlayerIDs);
          this._serverStartedAt = message.serverStartedAt;
          this._reportRoomConnection();
          break;
        case "joined":
          this.otherPlayerIDs.add(message.playerID);
          this._reportRoomConnection();
          break;
        case "left":
          this.otherPlayerIDs.delete(message.playerID);
          this._reportRoomConnection();
          break;
        case "race":
          this._onRace(message);
          break;
        case "gone": {
          const restarted =
            this._serverStartedAt && message.serverStartedAt !== this._serverStartedAt;
          this.turnedAway = {reason: restarted ? "restarted" : "gone", errorID: message.errorID};
          break;
        }
        case "full":
        case "outdated":
        case "closing":
          this.turnedAway = {reason: message.type, errorID: message.errorID};
          break;
      }
    };
  }

  // _reportRoomConnection calls onChange with the connection to the room as
  // it is now: its status, this player's id and the others'. It is called
  // both when the socket closes and when the relay says something changed in
  // the room, since either changes the room connection (see RoomConnection).
  _reportRoomConnection() {
    this._onChange({
      status: this.status,
      yourID: this.yourID,
      otherPlayerIDs: [...this.otherPlayerIDs],
      turnedAway: this.turnedAway,
    });
  }
}
