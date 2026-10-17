package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"strings"
)

// ServeRooms makes rooms for races and says what is in them, so that
// players can race together without sharing links: one starts a new race
// and reads its code out to the others, who join it by typing the code, or
// anyone auto joins and is put in a race on the same track with a seat for
// them. A room's code is its name, which players then join at /ws
// (see ServeHTTP). Every request and response is JSON:
//
//   - POST /rooms/new {"game", "scene"}: makes a room for a race of game's
//     scene, such as "bubble-squadron" and "race.json", which only those who
//     know its code can join, and returns {"code"}.
//   - POST /rooms/auto {"game", "scene"}: returns {"code"} of a room for a
//     race of game's scene that anyone can be put in and has a seat free,
//     the fullest one, so that races fill up, or of a new one.
//   - GET /rooms/{code}: returns {"code", "game", "scene", "players",
//     "full"}, what the room's race is, how many are in it, and whether it
//     has no seat free, or 404 when there is no such room.
//
// Codes are four capital letters, without I and O, which look like 1 and 0,
// such as "KXQM", and a code in a request can be in any case.
func (relay *Relay) ServeRooms(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	switch {
	case r.Method == http.MethodPost && (path == "new" || path == "auto"):
		var race struct {
			Game  string `json:"game"`
			Scene string `json:"scene"`
		}
		if json.NewDecoder(r.Body).Decode(&race) != nil || race.Game == "" || race.Scene == "" {
			http.Error(w, `a race needs a "game" and a "scene"`, http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]string{"code": relay.roomFor(race.Game, race.Scene, path == "auto")})
	case r.Method == http.MethodGet && path != "":
		info, ok := relay.roomInfo(strings.ToUpper(path))
		if !ok {
			http.Error(w, "no race with that code", http.StatusNotFound)
			return
		}
		writeJSON(w, info)
	default:
		http.NotFound(w, r)
	}
}

// roomInfo is what GET /rooms/{code} says about the room with code, and
// whether there is one.
type roomInfo struct {
	Code    string `json:"code"`
	Game    string `json:"game"`
	Scene   string `json:"scene"`
	Players int    `json:"players"`
	Full    bool   `json:"full"`
}

func (relay *Relay) roomInfo(code string) (roomInfo, bool) {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	relay.forgetEmptyRooms()
	r := relay.roomsByName[code]
	if r == nil {
		return roomInfo{}, false
	}
	return roomInfo{
		Code:    code,
		Game:    r.game,
		Scene:   r.scene,
		Players: len(r.playersByID),
		Full:    relay.isFull(r),
	}, true
}

// roomFor is the code of a room for a race of game's scene: to auto join,
// the fullest public one with a seat free, or else a new room, public to
// auto join, and only for those who know its code otherwise.
func (relay *Relay) roomFor(game, scene string, auto bool) string {
	relay.mu.Lock()
	defer relay.mu.Unlock()

	relay.forgetEmptyRooms()
	if auto {
		best, bestPlayers := "", -1
		for code, r := range relay.roomsByName {
			if r.public && r.game == game && r.scene == scene && !relay.isFull(r) &&
				len(r.playersByID) > bestPlayers {
				best, bestPlayers = code, len(r.playersByID)
			}
		}
		if best != "" {
			return best
		}
	}

	code := relay.newCode()
	r := relay.addRoom(code)
	r.game, r.scene, r.public = game, scene, auto
	return code
}

// The letters codes are made of: capitals, without I and O.
const codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ"

// newCode is a code no room has. The relay's lock must be held.
func (relay *Relay) newCode() string {
	for {
		code := make([]byte, 4)
		for i := range code {
			code[i] = codeLetters[rand.Intn(len(codeLetters))]
		}
		if relay.roomsByName[string(code)] == nil {
			return string(code)
		}
	}
}

// isFull is whether r has no seat free. The relay's lock must be held.
func (relay *Relay) isFull(r *room) bool {
	return relay.MaxPlayers > 0 && len(r.playersByID) >= relay.MaxPlayers
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
