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

func TestFilesTellBrowsersHowLongToKeepEachFile(t *testing.T) {
	root := t.TempDir()
	for _, file := range []string{"index.html", "page.html", "scene.json", "app.3f9a2c41d0.js"} {
		if err := os.WriteFile(filepath.Join(root, file), []byte("file"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	server := httptest.NewServer(Files(root))
	defer server.Close()

	for path, want := range map[string]string{
		"/app.3f9a2c41d0.js": "public, max-age=31536000, immutable",
		"/":                  "no-store",
		"/index.html":        "no-store",
		"/page.html":         "no-store",
		"/scene.json":        "no-cache",
	} {
		resp, err := http.Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if got := resp.Header.Get("Cache-Control"); got != want {
			t.Errorf("%s: got Cache-Control %q, want %q", path, got, want)
		}
	}
}

func TestFilesAnswerACurrentCopyWithoutTheFile(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "scene.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(Files(root))
	defer server.Close()

	resp, err := http.Get(server.URL + "/scene.json")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	req, _ := http.NewRequest("GET", server.URL+"/scene.json", nil)
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
