// The scenic server serves everything the arcade and the editor need: their
// pages and the files they load, such as bundles, games and models, and the
// rooms players play together in, at /ws (see Relay), which races are made
// and found in at /rooms/ (see ServeRooms).
//
//	go run . -addr :3000 -static ..
//
// serves the repo's root from server/, with the arcade at
// /apps/arcade/index.html and the editor at /apps/editor/index.html.
package main

import (
	"flag"
	"log"
	"net/http"
	"strings"
)

func main() {
	addr := flag.String("addr", ":3000", "the address to listen on")
	static := flag.String(
		"static",
		"",
		"a folder to serve files from, such as the repo's root; without one, only rooms are served",
	)
	origins := flag.String(
		"origins",
		"*",
		"the hosts of the pages allowed to join rooms, comma separated, such as localhost:*; * allows any",
	)
	maxPlayers := flag.Int("max-players", 6, "the most players in a room, or 0 for no limit")
	flag.Parse()

	relay := &Relay{OriginPatterns: strings.Split(*origins, ","), MaxPlayers: *maxPlayers}
	http.Handle("/ws", relay)
	http.HandleFunc("/rooms/", relay.ServeRooms)
	if *static != "" {
		http.Handle("/", Files(*static))
		log.Printf("serving files from %s", *static)
	}
	log.Printf("listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
