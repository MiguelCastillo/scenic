// The scenic server serves everything the arcade and the editor need: their
// pages and the files they load, such as bundles, games and models, and the
// rooms players play together in, at /ws (see Relay).
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
	flag.Parse()

	http.Handle("/ws", &Relay{OriginPatterns: strings.Split(*origins, ",")})
	if *static != "" {
		http.Handle("/", Files(*static))
		log.Printf("serving files from %s", *static)
	}
	log.Printf("listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}
