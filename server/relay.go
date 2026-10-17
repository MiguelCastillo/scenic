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
// game: each player's browser runs it and owns its own player, such as a
// ship, and sends the others whatever the game wants them to know about it,
// such as where its ship is, which the relay forwards to the other players
// in the room without looking inside, so that each browser can show
// everyone.
//
// A player joins a room by connecting to /ws?room=name with a WebSocket.
// Every message is JSON. A player only ever sends messages for the others,
// and everything about who is in the room comes from the relay:
//
// From a player (see messageFromPlayer):
//   - {"type": "message", "message": {...}}: a message for the others in
//     the room, forwarded to them as is.
//
// To a player (see messageToPlayer):
//   - {"type": "welcome", "yourID": "p1", "otherPlayerIDs": ["p2"]}: the
//     player's id, and the ids of the others already in the room, when the
//     player joins.
//   - {"type": "joined", "playerID": "p3"}: someone joined the room.
//   - {"type": "left", "playerID": "p2"}: someone left the room.
//   - {"type": "message", "playerID": "p2", "message": {...}}: a message
//     another player sent.
//   - {"type": "full"}: the room already has MaxPlayers players, so the
//     player can't join it, and the connection closes.
//
// A room exists while it has players in it, and for EmptyRoomTime after the
// last one leaves, so that a room made for a race (see ServeRooms) is still
// there for its players to come back to, such as when they reload the page.
// A player that can't keep up with the messages to it misses some, rather
// than holding up the room.
type Relay struct {
	// OriginPatterns are the hosts of the pages allowed to connect, such as
	// "localhost:*", or "*" for any host (see websocket.AcceptOptions).
	// The relay holds nothing private, so letting pages anywhere connect,
	// such as on a tablet on the same network, only lets them join rooms.
	OriginPatterns []string

	// MaxPlayers is the most players a room can have at once, or 0 for no
	// limit.
	MaxPlayers int

	// EmptyRoomTime is how long a room is kept after the last player leaves
	// it, or before the first one joins. 2 minutes when 0.
	EmptyRoomTime time.Duration

	mu          sync.Mutex
	roomsByName map[string]*room
	lastID      int
}

type room struct {
	playersByID map[string]*player

	// Game and Scene are what the room's players play, such as
	// "bubble-squadron" and "race.json", for a room made for a race (see
	// ServeRooms), and empty for one made by joining it.
	game, scene string

	// public is whether anyone can be put in the room by auto join (see
	// ServeRooms), rather than only those who know its code.
	public bool

	// emptySince is when the room was last left empty, or made without
	// anyone in it, to forget it once it has been empty for EmptyRoomTime.
	emptySince time.Time
}

type player struct {
	id string
	// out holds the messages waiting to be written to the player.
	out chan []byte
}

// messageFromPlayer is what a player sends, as JSON: only messages for the
// others in the room. Anything else in it is ignored, such as an id, so that
// a player can't speak for another.
type messageFromPlayer struct {
	// Type is "message".
	Type string `json:"type"`

	// Message is what the player has to say to the others, which the relay
	// forwards as is, without looking inside, since what it holds is the
	// game's business.
	Message json.RawMessage `json:"message"`
}

// messageToPlayer is what the relay sends a player, as JSON. Which fields it
// has depends on its type (see Relay for every type), and the others are left
// out. Every id in it comes from the relay.
type messageToPlayer struct {
	// Type is what the message is: "welcome", "joined", "left" or
	// "message".
	Type string `json:"type"`

	// YourID is the id the relay gave the player, such as "p1", in their
	// "welcome".
	YourID string `json:"yourID,omitempty"`

	// OtherPlayerIDs are the ids of the others already in the room, in a
	// player's "welcome".
	OtherPlayerIDs []string `json:"otherPlayerIDs,omitempty"`

	// PlayerID is the id of the player the message is about: who joined or
	// left, or who sent a "message". It is how a player's browser tells the
	// others apart, such as which copy of a ship in its scene a message
	// moves, since what they send has no id in it.
	PlayerID string `json:"playerID,omitempty"`

	// Message is what another player sent, in a "message", as they sent it.
	Message json.RawMessage `json:"message,omitempty"`
}

const (
	// How many messages can wait to be written to a player before the
	// newest are dropped.
	outBufferSize = 64
	// The longest message a player can send, in bytes.
	maxMessageSize = 64 * 1024
	// The longest room name, in bytes.
	maxRoomNameSize = 64
	// How long a room is kept empty when Relay.EmptyRoomTime isn't set.
	defaultEmptyRoomTime = 2 * time.Minute
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
	if p == nil {
		ctx, cancel := context.WithTimeout(r.Context(), writeTimeout)
		defer cancel()
		data, _ := json.Marshal(messageToPlayer{Type: "full"})
		conn.Write(ctx, websocket.MessageText, data)
		conn.Close(websocket.StatusPolicyViolation, "the room is full")
		return
	}
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

	// The player's messages go to the others in the room until the player
	// leaves.
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var m messageFromPlayer
		if json.Unmarshal(data, &m) != nil || m.Type != "message" {
			continue
		}
		relay.broadcast(name, p, messageToPlayer{Type: "message", PlayerID: p.id, Message: m.Message})
	}
}

// join adds a new player to the room, making the room if it is new, and
// returns the player, or nil when the room is full. The player is welcomed
// with the ids of the others already there before any other message, and
// the others are told about the new player.
func (relay *Relay) join(name string) *player {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	relay.forgetEmptyRooms()
	r := relay.roomsByName[name]
	if r == nil {
		r = relay.addRoom(name)
	}
	if relay.isFull(r) {
		return nil
	}

	relay.lastID++
	p := &player{id: fmt.Sprintf("p%d", relay.lastID), out: make(chan []byte, outBufferSize)}
	others := []string{}
	for id, other := range r.playersByID {
		others = append(others, id)
		other.send(messageToPlayer{Type: "joined", PlayerID: p.id})
	}
	p.send(messageToPlayer{Type: "welcome", YourID: p.id, OtherPlayerIDs: others})
	r.playersByID[p.id] = p
	return p
}

// leave takes the player out of the room and tells the others. A room left
// empty is forgotten once it has been empty for EmptyRoomTime.
func (relay *Relay) leave(name string, p *player) {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	r := relay.roomsByName[name]
	delete(r.playersByID, p.id)
	if len(r.playersByID) == 0 {
		r.emptySince = time.Now()
		return
	}
	for _, other := range r.playersByID {
		other.send(messageToPlayer{Type: "left", PlayerID: p.id})
	}
}

// broadcast sends m to everyone in the room but from.
func (relay *Relay) broadcast(name string, from *player, m messageToPlayer) {
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
func (p *player) send(m messageToPlayer) {
	data, err := json.Marshal(m)
	if err != nil {
		return
	}
	select {
	case p.out <- data:
	default:
	}
}

// addRoom makes an empty room called name. The relay's lock must be held.
func (relay *Relay) addRoom(name string) *room {
	if relay.roomsByName == nil {
		relay.roomsByName = map[string]*room{}
	}
	r := &room{playersByID: map[string]*player{}, emptySince: time.Now()}
	relay.roomsByName[name] = r
	return r
}

// forgetEmptyRooms forgets the rooms that have been empty for
// EmptyRoomTime. The relay's lock must be held.
func (relay *Relay) forgetEmptyRooms() {
	emptyRoomTime := relay.EmptyRoomTime
	if emptyRoomTime == 0 {
		emptyRoomTime = defaultEmptyRoomTime
	}
	for name, r := range relay.roomsByName {
		if len(r.playersByID) == 0 && time.Since(r.emptySince) >= emptyRoomTime {
			delete(relay.roomsByName, name)
		}
	}
}
