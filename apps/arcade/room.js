// RoomConnection joins a room on the relay, at /ws on the server the page
// came from (see server/relay.go), so that players who open the arcade with
// the same ?room= play together. Each player's browser runs the game and
// owns its own player, sends the others messages about it with send, and
// hears theirs. What the messages hold is the game's business.
//
// onChange is called with {connected, you, players} whenever any of them
// changes: whether it is connected, this player's id, and the ids of the
// others in the room. onMessage is called with (player, message) for every
// message another player sends.
//
// Its API: send(message), close(), connected, you and players.
export class RoomConnection {
  constructor(room, {onChange = () => {}, onMessage = () => {}} = {}) {
    this.connected = false;
    this.you = null;
    this.players = new Set();

    const url = new URL("/ws", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("room", room);
    this._socket = new WebSocket(url);

    const changed = () =>
      onChange({connected: this.connected, you: this.you, players: [...this.players]});

    this._socket.addEventListener("close", () => {
      this.connected = false;
      this.players.clear();
      changed();
    });
    this._socket.addEventListener("message", (evt) => {
      const message = JSON.parse(evt.data);
      switch (message.type) {
        case "welcome":
          this.connected = true;
          this.you = message.you;
          this.players = new Set(message.players);
          changed();
          break;
        case "joined":
          this.players.add(message.player);
          changed();
          break;
        case "left":
          this.players.delete(message.player);
          changed();
          break;
        case "message":
          onMessage(message.player, message.message);
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
