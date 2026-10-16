package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Relay passes messages between the players of a room. It doesn't run the
// game: each player's browser runs it and owns its own ship, and sends what
// its ship is doing as a "state" message, which the relay forwards to the
// other players in the room, so that each browser can show everyone's ships.
//
// A player joins a room by connecting to /ws?room=name with a WebSocket.
// Every message is JSON:
//
// From a player:
//   - {"type": "state", "state": {...}}: what the player's ship is doing,
//     forwarded as is to the others in the room.
//
// To a player:
//   - {"type": "welcome", "you": "p1", "players": ["p2"]}: the player's id,
//     and who else is in the room, when the player joins.
//   - {"type": "joined", "player": "p3"}: someone joined the room.
//   - {"type": "left", "player": "p2"}: someone left the room.
//   - {"type": "state", "player": "p2", "state": {...}}: another player's
//     ship.
//
// A room exists while it has players in it. A player that can't keep up with
// the messages to it misses some, rather than holding up the room.
type Relay struct {
	// OriginPatterns are the hosts of the pages allowed to connect, such as
	// "localhost:*", or "*" for any host (see websocket.AcceptOptions).
	// The relay holds nothing private, so letting pages anywhere connect,
	// such as on a tablet on the same network, only lets them join rooms.
	OriginPatterns []string

	mu          sync.Mutex
	roomsByName map[string]*room
	lastID      int
}

type room struct {
	playersByID map[string]*player
}

type player struct {
	id string
	// out holds the messages waiting to be written to the player.
	out chan []byte
}

// message is every message there is, from a player or to one.
type message struct {
	Type    string          `json:"type"`
	You     string          `json:"you,omitempty"`
	Player  string          `json:"player,omitempty"`
	Players []string        `json:"players,omitempty"`
	State   json.RawMessage `json:"state,omitempty"`
}

const (
	// How many messages can wait to be written to a player before the
	// newest are dropped.
	outBufferSize = 64
	// The longest message a player can send, in bytes.
	maxMessageSize = 64 * 1024
	// The longest room name, in bytes.
	maxRoomNameSize = 64
	// How long writing a message to a player can take before the player is
	// dropped.
	writeTimeout = 5 * time.Second
)

// ServeHTTP joins the player connecting to the room the URL names.
func (relay *Relay) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("room")
	if name == "" || len(name) > maxRoomNameSize {
		http.Error(w, fmt.Sprintf("room must be 1 to %d bytes", maxRoomNameSize), http.StatusBadRequest)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: relay.OriginPatterns})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(maxMessageSize)

	p := relay.join(name)
	defer relay.leave(name, p)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Messages to the player are written one at a time, as they come.
	go func() {
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case data := <-p.out:
				writeCtx, cancelWrite := context.WithTimeout(ctx, writeTimeout)
				err := conn.Write(writeCtx, websocket.MessageText, data)
				cancelWrite()
				if err != nil {
					return
				}
			}
		}
	}()

	// The player's ship goes to the others in the room until the player
	// leaves.
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var m message
		if json.Unmarshal(data, &m) != nil || m.Type != "state" {
			continue
		}
		relay.broadcast(name, p, message{Type: "state", Player: p.id, State: m.State})
	}
}

// join adds a new player to the room, making the room if it is new, and
// returns the player. The player is welcomed with the ids of the others
// already there before any other message, and the others are told about the
// new player.
func (relay *Relay) join(name string) *player {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	if relay.roomsByName == nil {
		relay.roomsByName = map[string]*room{}
	}
	r := relay.roomsByName[name]
	if r == nil {
		r = &room{playersByID: map[string]*player{}}
		relay.roomsByName[name] = r
	}

	relay.lastID++
	p := &player{id: fmt.Sprintf("p%d", relay.lastID), out: make(chan []byte, outBufferSize)}
	others := []string{}
	for id, other := range r.playersByID {
		others = append(others, id)
		other.send(message{Type: "joined", Player: p.id})
	}
	p.send(message{Type: "welcome", You: p.id, Players: others})
	r.playersByID[p.id] = p
	return p
}

// leave takes the player out of the room, tells the others, and forgets the
// room once it is empty.
func (relay *Relay) leave(name string, p *player) {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	r := relay.roomsByName[name]
	delete(r.playersByID, p.id)
	if len(r.playersByID) == 0 {
		delete(relay.roomsByName, name)
		return
	}
	for _, other := range r.playersByID {
		other.send(message{Type: "left", Player: p.id})
	}
}

// broadcast sends m to everyone in the room but from.
func (relay *Relay) broadcast(name string, from *player, m message) {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	for _, other := range relay.roomsByName[name].playersByID {
		if other != from {
			other.send(m)
		}
	}
}

// send queues m to be written to the player, or drops it if the player is
// too far behind.
func (p *player) send(m message) {
	data, err := json.Marshal(m)
	if err != nil {
		return
	}
	select {
	case p.out <- data:
	default:
	}
}
