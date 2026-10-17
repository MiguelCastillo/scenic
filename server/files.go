package main

import (
	"net/http"
	"regexp"
	"strings"
)

// Files serves the files in the folder root, such as the repo's, with
// http.FileServer, except that a page's index.html is served where it is
// rather than redirected to its folder, which would drop the URL's query,
// such as the arcade's ?room=.
//
// It also tells browsers how long they can keep each file, since without
// being told, they guess from how old the file is, and use stale files
// without asking:
//   - A fingerprinted file, one with a hash of what is in it in its name,
//     such as an app's bundle, dist/arcade.3f9a2c41d0.js, is kept for good,
//     since a file that changes gets a new name (see bin/fingerprint.js).
//   - A page is never kept, so that it always names the latest
//     fingerprinted bundles.
//   - Anything else, such as a scene or a model, which changes as it is
//     worked on, is kept but checked to still be current before it is used.
//     One that hasn't changed is answered quickly, with 304 Not Modified.
func Files(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", cacheControl(r.URL.Path))
		if strings.HasSuffix(r.URL.Path, "/index.html") {
			r.URL.Path = strings.TrimSuffix(r.URL.Path, "index.html")
		}
		files.ServeHTTP(w, r)
	})
}

// fingerprinted matches the names bin/fingerprint.js gives files, with ten
// hex digits of their hash before their extension.
var fingerprinted = regexp.MustCompile(`\.[0-9a-f]{10}\.[a-z]+$`)

// cacheControl is how long browsers can keep the file at path (see Files).
func cacheControl(path string) string {
	switch {
	case fingerprinted.MatchString(path):
		return "public, max-age=31536000, immutable"
	case strings.HasSuffix(path, "/") || strings.HasSuffix(path, ".html"):
		return "no-store"
	default:
		return "no-cache"
	}
}
