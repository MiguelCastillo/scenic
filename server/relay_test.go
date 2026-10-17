package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// newServer starts a relay for a test, and returns its WebSocket URL.
func newServer(t *testing.T) string {
	t.Helper()
	server := httptest.NewServer(&Relay{})
	t.Cleanup(server.Close)
	return "ws" + strings.TrimPrefix(server.URL, "http")
}

// client is a player connected to a test relay.
type client struct {
	t    *testing.T
	conn *websocket.Conn
}

// join connects a player to the room, and returns it with its welcome.
func join(t *testing.T, serverURL, room string) (*client, message) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, serverURL+"?room="+url.QueryEscape(room), nil)
	if err != nil {
		t.Fatalf("joining %q: %v", room, err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	c := &client{t: t, conn: conn}
	return c, c.next()
}

// next is the next message to the player.
func (c *client) next() message {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	var m message
	if err := wsjson.Read(ctx, c.conn, &m); err != nil {
		c.t.Fatalf("reading: %v", err)
	}
	return m
}

// nothing checks that no message comes to the player for a little while.
func (c *client) nothing() {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	var m message
	if err := wsjson.Read(ctx, c.conn, &m); err == nil {
		c.t.Fatalf("got %+v, want nothing", m)
	}
}

func (c *client) send(message string) {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	m := map[string]any{"type": "message", "message": json.RawMessage(message)}
	if err := wsjson.Write(ctx, c.conn, m); err != nil {
		c.t.Fatalf("sending: %v", err)
	}
}

func TestWelcomesPlayersWithWhoIsThere(t *testing.T) {
	url := newServer(t)
	_, first := join(t, url, "race")
	if first.Type != "welcome" || first.You == "" || len(first.Players) != 0 {
		t.Fatalf("first player's welcome is %+v", first)
	}

	_, second := join(t, url, "race")
	if second.Type != "welcome" || len(second.Players) != 1 || second.Players[0] != first.You {
		t.Fatalf("second player's welcome is %+v, want it to list %s", second, first.You)
	}
}

func TestTellsPlayersWhoJoinsAndLeaves(t *testing.T) {
	url := newServer(t)
	a, _ := join(t, url, "race")
	b, welcome := join(t, url, "race")

	if m := a.next(); m.Type != "joined" || m.Player != welcome.You {
		t.Fatalf("got %+v, want %s joined", m, welcome.You)
	}

	b.conn.Close(websocket.StatusNormalClosure, "")
	if m := a.next(); m.Type != "left" || m.Player != welcome.You {
		t.Fatalf("got %+v, want %s left", m, welcome.You)
	}
}

func TestRelaysMessagesToTheOthersInTheRoom(t *testing.T) {
	url := newServer(t)
	a, aWelcome := join(t, url, "race")
	b, _ := join(t, url, "race")
	c, _ := join(t, url, "other race")
	a.next() // b joined

	a.send(`{"position":[1,2,3]}`)

	m := b.next()
	if m.Type != "message" || m.Player != aWelcome.You || string(m.Message) != `{"position":[1,2,3]}` {
		t.Fatalf("got %+v, want a's message", m)
	}
	a.nothing()
	c.nothing()
}

func TestRefusesRoomsWithoutAName(t *testing.T) {
	url := newServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, resp, err := websocket.Dial(ctx, url, nil)
	if err == nil || resp == nil || resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("got %v, want a bad request", err)
	}
}

func TestOriginPatternsChooseWhichPagesCanConnect(t *testing.T) {
	dial := func(patterns []string, origin string) error {
		server := httptest.NewServer(&Relay{OriginPatterns: patterns})
		defer server.Close()
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http")+"?room=race",
			&websocket.DialOptions{HTTPHeader: http.Header{"Origin": {origin}}})
		if err == nil {
			conn.CloseNow()
		}
		return err
	}

	if err := dial([]string{"*"}, "http://192.168.1.20:3000"); err != nil {
		t.Fatalf("* refused a page on another host: %v", err)
	}
	if err := dial([]string{"localhost:*"}, "http://192.168.1.20:3000"); err == nil {
		t.Fatalf("localhost:* let a page on another host connect")
	}
	if err := dial([]string{"localhost:*"}, "http://localhost:3000"); err != nil {
		t.Fatalf("localhost:* refused a page on localhost: %v", err)
	}
}
