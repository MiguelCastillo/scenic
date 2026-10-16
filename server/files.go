package main

import (
	"net/http"
	"strings"
)

// Files serves the files in the folder root, such as the repo's, with
// http.FileServer, except that a page's index.html is served where it is
// rather than redirected to its folder, which would drop the URL's query,
// such as the arcade's ?room=.
func Files(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/index.html") {
			r.URL.Path = strings.TrimSuffix(r.URL.Path, "index.html")
		}
		files.ServeHTTP(w, r)
	})
}
