package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

// newRoomsServer starts a relay with its rooms for a test, and returns its
// HTTP URL.
func newRoomsServer(t *testing.T, relay *Relay) string {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle("/ws", relay)
	mux.HandleFunc("/rooms/", relay.ServeRooms)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server.URL
}

// postRace asks the server at serverURL for a room for a race, at
// /rooms/new or /rooms/auto, and returns its code.
func postRace(t *testing.T, serverURL, kind, game, scene string) string {
	t.Helper()
	body := strings.NewReader(`{"game": "` + game + `", "scene": "` + scene + `"}`)
	res, err := http.Post(serverURL+"/rooms/"+kind, "application/json", body)
	if err != nil {
		t.Fatalf("posting: %v", err)
	}
	defer res.Body.Close()
	var got struct{ Code string }
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
		t.Fatalf("reading: %v", err)
	}
	return got.Code
}

// getRoom is what the server at serverURL says about the room with code,
// and its status.
func getRoom(t *testing.T, serverURL, code string) (roomInfo, int) {
	t.Helper()
	res, err := http.Get(serverURL + "/rooms/" + code)
	if err != nil {
		t.Fatalf("getting: %v", err)
	}
	defer res.Body.Close()
	var info roomInfo
	if res.StatusCode == http.StatusOK {
		json.NewDecoder(res.Body).Decode(&info)
	}
	return info, res.StatusCode
}

func wsURL(serverURL string) string {
	return "ws" + strings.TrimPrefix(serverURL, "http") + "/ws"
}

func TestStartsANewRaceWithACode(t *testing.T) {
	url := newRoomsServer(t, &Relay{})
	code := postRace(t, url, "new", "bubble-squadron", "race.json")
	if !regexp.MustCompile(`^[A-HJ-NP-Z]{4}$`).MatchString(code) {
		t.Fatalf("code is %q, want four capitals without I and O", code)
	}

	info, status := getRoom(t, url, strings.ToLower(code))
	want := roomInfo{Code: code, Game: "bubble-squadron", Scene: "race.json"}
	if status != http.StatusOK || info != want {
		t.Fatalf("room is %+v (%d), want %+v", info, status, want)
	}

	join(t, wsURL(url), code)
	if info, _ := getRoom(t, url, code); info.Players != 1 {
		t.Fatalf("room has %d players, want 1", info.Players)
	}
}

func TestSaysThereIsNoRaceForAnUnknownCode(t *testing.T) {
	url := newRoomsServer(t, &Relay{})
	if _, status := getRoom(t, url, "ZZZZ"); status != http.StatusNotFound {
		t.Fatalf("status is %d, want 404", status)
	}
}

func TestAutoJoinSharesARoomOnTheSameTrack(t *testing.T) {
	url := newRoomsServer(t, &Relay{MaxPlayers: 2})
	first := postRace(t, url, "auto", "bubble-squadron", "race.json")
	join(t, wsURL(url), first)

	if again := postRace(t, url, "auto", "bubble-squadron", "race.json"); again != first {
		t.Fatalf("auto join is in %q, want the room with a seat, %q", again, first)
	}
	if other := postRace(t, url, "auto", "bubble-squadron", "highway.json"); other == first {
		t.Fatalf("auto join on another track is in the same room, %q", other)
	}
	if started := postRace(t, url, "new", "bubble-squadron", "race.json"); started == first {
		t.Fatalf("a new race is in the auto joined room, %q", started)
	}

	join(t, wsURL(url), first)
	if next := postRace(t, url, "auto", "bubble-squadron", "race.json"); next == first {
		t.Fatalf("auto join is in the full room, %q", next)
	}
}

func TestAutoJoinSkipsRacesStartedWithACode(t *testing.T) {
	url := newRoomsServer(t, &Relay{})
	started := postRace(t, url, "new", "bubble-squadron", "race.json")
	join(t, wsURL(url), started)
	if auto := postRace(t, url, "auto", "bubble-squadron", "race.json"); auto == started {
		t.Fatalf("auto join is in the started race, %q", auto)
	}
}

func TestTurnsAwayPlayersFromAFullRoom(t *testing.T) {
	url := newRoomsServer(t, &Relay{MaxPlayers: 1})
	code := postRace(t, url, "new", "bubble-squadron", "race.json")
	join(t, wsURL(url), code)
	if info, _ := getRoom(t, url, code); !info.Full {
		t.Fatalf("room is %+v, want full", info)
	}

	_, m := join(t, wsURL(url), code)
	if m.Type != "full" {
		t.Fatalf("got %+v, want full", m)
	}
}

func TestKeepsAnEmptyRoomForItsPlayersToComeBack(t *testing.T) {
	relay := &Relay{}
	url := newRoomsServer(t, relay)
	code := postRace(t, url, "new", "bubble-squadron", "race.json")
	c, _ := join(t, wsURL(url), code)
	c.conn.CloseNow()

	if _, status := getRoom(t, url, code); status != http.StatusOK {
		t.Fatalf("status is %d, want the room still there", status)
	}
}

func TestForgetsARoomEmptyForLong(t *testing.T) {
	relay := &Relay{EmptyRoomTime: -1}
	url := newRoomsServer(t, relay)
	code := postRace(t, url, "new", "bubble-squadron", "race.json")
	if _, status := getRoom(t, url, code); status != http.StatusNotFound {
		t.Fatalf("status is %d, want the empty room forgotten", status)
	}
}
