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

  test("keeps a game's files for good at its version, and never at another", async () => {
    server = await startServer({
      root: withFiles({
        "games/race/version.json": JSON.stringify({
          version: "abc123",
          resources: ["resources/used.js"],
        }),
        "games/race/track.json": "{}",
        "resources/used.js": "",
      }),
    });
    const cacheControl = async (file) =>
      (await fetch(server.url + file)).headers.get("cache-control");

    expect(await cacheControl("/games/race/track.json?v=race.abc123")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(await cacheControl("/resources/used.js?v=race.abc123")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(await cacheControl("/games/race/track.json?v=race.def456")).toBe("no-store");
    expect(await cacheControl("/games/race/track.json")).toBe("no-cache");
  });

  test("logs a shared file a game loads that its version doesn't cover, once", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    server = await startServer({
      root: withFiles({
        "games/race/version.json": JSON.stringify({
          version: "abc123",
          resources: ["resources/used.js"],
        }),
        "resources/used.js": "",
        "resources/unnamed.png": "",
      }),
    });

    await fetch(`${server.url}/resources/used.js?v=race.abc123`);
    expect(logged).not.toHaveBeenCalled();
    await fetch(`${server.url}/resources/unnamed.png?v=race.abc123`);
    await fetch(`${server.url}/resources/unnamed.png?v=race.abc123`);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toMatch(
      /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}: race's version abc123 doesn't cover resources\/unnamed.png/
    );
    logged.mockRestore();
  });

  test("serves nothing outside its folder", async () => {
    server = await startServer({root: withFiles({"scene.json": "{}"})});
    const response = await fetch(`${server.url}/%2e%2e/%2e%2e/etc/hosts`);
    expect(response.status).toBe(404);
  });
});
