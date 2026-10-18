import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {startServer} from "./test-server.js";

// withFiles makes a folder for a test with files, by their paths, and
// returns it.
function withFiles(contentByPath) {
  const root = mkdtempSync(path.join(tmpdir(), "scenic-files-"));
  for (const [filePath, content] of Object.entries(contentByPath)) {
    mkdirSync(path.dirname(path.join(root, filePath)), {recursive: true});
    writeFileSync(path.join(root, filePath), content);
  }
  return root;
}

describe("files", () => {
  let server;
  afterEach(() => server?.stop());

  test("serves index pages where they are", async () => {
    server = await startServer({root: withFiles({"apps/arcade/index.html": "arcade"})});
    for (const page of ["/apps/arcade/index.html?room=race", "/apps/arcade/?room=race"]) {
      const response = await fetch(server.url + page, {redirect: "manual"});
      expect([page, response.status, await response.text()]).toEqual([page, 200, "arcade"]);
    }
  });

  test("sends a folder without its slash to it, keeping the query", async () => {
    server = await startServer({root: withFiles({"apps/arcade/index.html": "arcade"})});
    const response = await fetch(`${server.url}/apps/arcade?room=race`, {redirect: "manual"});
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/apps/arcade/?room=race");
  });

  test("tells browsers how long to keep each file", async () => {
    server = await startServer({
      root: withFiles({
        "index.html": "",
        "page.html": "",
        "scene.json": "",
        "app.3f9a2c41d0.js": "",
      }),
    });
    const cacheControlByPath = {
      "/app.3f9a2c41d0.js": "public, max-age=31536000, immutable",
      "/": "no-store",
      "/index.html": "no-store",
      "/page.html": "no-store",
      "/scene.json": "no-cache",
    };
    for (const [filePath, cacheControl] of Object.entries(cacheControlByPath)) {
      const response = await fetch(server.url + filePath);
      expect([filePath, response.headers.get("cache-control")]).toEqual([filePath, cacheControl]);
    }
  });

  test("answers a current copy without the file", async () => {
    server = await startServer({root: withFiles({"scene.json": "{}"})});
    const first = await fetch(`${server.url}/scene.json`);
    const again = await fetch(`${server.url}/scene.json`, {
      headers: {"If-Modified-Since": first.headers.get("last-modified")},
    });
    expect(again.status).toBe(304);
  });

  test("serves nothing outside its folder", async () => {
    server = await startServer({root: withFiles({"scene.json": "{}"})});
    const response = await fetch(`${server.url}/%2e%2e/%2e%2e/etc/hosts`);
    expect(response.status).toBe(404);
  });
});
