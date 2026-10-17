package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestFilesServesIndexPagesWhereTheyAre(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "apps", "arcade"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "apps", "arcade", "index.html"), []byte("arcade"), 0o644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(Files(root))
	defer server.Close()

	client := &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	for _, path := range []string{"/apps/arcade/index.html?room=race", "/apps/arcade/?room=race"} {
		resp, err := client.Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK || string(body) != "arcade" {
			t.Errorf("%s: got %d %q, want the page", path, resp.StatusCode, body)
		}
	}
}

func TestFilesTellBrowsersToCheckTheirCopyIsCurrent(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "bundle.js"), []byte("code"), 0o644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(Files(root))
	defer server.Close()

	resp, err := http.Get(server.URL + "/bundle.js")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("got Cache-Control %q, want no-cache", got)
	}

	// A copy that is still current is answered without the file.
	req, _ := http.NewRequest("GET", server.URL+"/bundle.js", nil)
	req.Header.Set("If-Modified-Since", resp.Header.Get("Last-Modified"))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotModified {
		t.Fatalf("got %d for a current copy, want 304", resp.StatusCode)
	}
}
