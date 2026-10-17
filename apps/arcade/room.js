// RoomConnection joins a room on the relay, at /ws on the server the page
// came from (see server/relay.go), so that players who open the arcade with
// the same ?room= play together. Each player's browser runs the game and
// owns its own player, sends the others messages about it with send, and
// hears theirs. What the messages hold is the game's business.
//
// Players are known by the ids the relay gives them, such as "p2". onChange
// is called with {connected, yourID, otherPlayerIDs} whenever any of them
// changes: whether it is connected, this player's id, and the ids of the
// others in the room. onMessage is called with (playerID, message) for every
// message another player sends.
//
// Its API: send(message), close(), connected, yourID and otherPlayerIDs.
export class RoomConnection {
  constructor(room, {onChange = () => {}, onMessage = () => {}} = {}) {
    this.connected = false;
    this.yourID = null;
    this.otherPlayerIDs = new Set();

    const url = new URL("/ws", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("room", room);
    this._socket = new WebSocket(url);

    const changed = () =>
      onChange({
        connected: this.connected,
        yourID: this.yourID,
        otherPlayerIDs: [...this.otherPlayerIDs],
      });

    this._socket.addEventListener("close", () => {
      this.connected = false;
      this.otherPlayerIDs.clear();
      changed();
    });
    this._socket.addEventListener("message", (evt) => {
      const message = JSON.parse(evt.data);
      switch (message.type) {
        case "welcome":
          this.connected = true;
          this.yourID = message.yourID;
          this.otherPlayerIDs = new Set(message.otherPlayerIDs);
          changed();
          break;
        case "joined":
          this.otherPlayerIDs.add(message.playerID);
          changed();
          break;
        case "left":
          this.otherPlayerIDs.delete(message.playerID);
          changed();
          break;
        case "message":
          onMessage(message.playerID, message.message);
          break;
      }
    });
  }

  send(message) {
    if (this.connected) {
      this._socket.send(JSON.stringify({type: "message", message}));
    }
  }

  close() {
    this._socket.close();
  }
}
