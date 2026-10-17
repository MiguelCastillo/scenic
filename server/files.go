package main

import (
	"net/http"
	"strings"
)

// Files serves the files in the folder root, such as the repo's, with
// http.FileServer, except that:
//   - A page's index.html is served where it is rather than redirected to its
//     folder, which would drop the URL's query, such as the arcade's ?room=.
//   - Browsers are told to check every file is still current before using
//     their copy of it, with Cache-Control: no-cache. Files change as they
//     are worked on, such as a bundle rebuilt by a watcher, and without it
//     browsers guess how long their copy is good for from how old the file
//     is, and use a stale bundle without asking. A file that hasn't changed
//     is still answered quickly, with 304 Not Modified.
func Files(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/index.html") {
			r.URL.Path = strings.TrimSuffix(r.URL.Path, "index.html")
		}
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	})
}
