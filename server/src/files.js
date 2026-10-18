import {createReadStream, existsSync, readFileSync, statSync} from "node:fs";
import {stat} from "node:fs/promises";
import path from "node:path";

import {newErrorID} from "./error-ids.js";

// The types of the files the apps load, by their extension. Anything else
// is sent as bytes.
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".obj": "text/plain; charset=utf-8",
  ".mtl": "text/plain; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8",
  ".vert": "text/plain; charset=utf-8",
  ".frag": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

// files serves the files in the folder root, such as the repo's: a request
// handler, (request, response) => {}. A folder serves its index.html, and a
// page's index.html is served where it is rather than redirected to its
// folder, which would drop the URL's query, such as the arcade's ?room=.
//
// It also tells browsers how long they can keep each file, since without
// being told, they guess from how old the file is, and use stale files
// without asking (see cacheControl). A browser that asks whether its copy
// is still current, with the Last-Modified it was given, is answered
// quickly, with 304 Not Modified, when it is.
//
// A game's file asked for at the game's version, with its "v", such as
// ?v=bubble-squadron.3f9a2c41d0 (see versionedURL in @scenic/runtime), is
// kept for good, since any change to what the game uses gives it a new
// version (see bin/version-games.js), and is never kept at another version,
// such as an older page's, so that a file's new content is never kept
// under an old version. The same goes for a file asked for at an app's
// version, such as a shader at ?v=arcade.3f9a2c41d0 (see
// bin/fingerprint.js). A shared file in resources/ that a game's page asks
// for at its version, which its version doesn't cover, is logged with an
// error id, once, since a change to it wouldn't give the game a new
// version: bin/version-games.js needs to learn what names it.
export function files(root) {
  const base = path.resolve(root);
  // Each game's or app's version as of its version.json, by its name, as
  // {modified, version, resources}, read again when the file changes, and
  // the shared files already logged as missing from a game's version.
  const versionsByName = new Map();
  const loggedMissing = new Set();
  const versionOf = (name) => {
    const file = [
      path.join(base, "games", name, "version.json"),
      path.join(base, "apps", name, "version.json"),
    ].find(existsSync);
    try {
      const modified = statSync(file).mtimeMs;
      if (versionsByName.get(name)?.modified !== modified) {
        const {version, resources = []} = JSON.parse(readFileSync(file, "utf8"));
        versionsByName.set(name, {modified, version, resources: new Set(resources)});
      }
      return versionsByName.get(name);
    } catch {
      return null;
    }
  };

  return async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    let filePath = path.join(base, decodeURIComponent(url.pathname));
    // Nothing outside root is served, such as with "..".
    if (filePath !== base && !filePath.startsWith(base + path.sep)) {
      return notFound(response);
    }

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      // A folder is its index page, at the folder's URL with a slash, so
      // that the page's own links work.
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, {Location: `${url.pathname}/${url.search}`});
        return response.end();
      }
      filePath = path.join(filePath, "index.html");
      info = await stat(filePath).catch(() => null);
    }
    if (!info?.isFile()) {
      return notFound(response);
    }

    // A file asked for at a game's or an app's version, if it is.
    const [, owner, version] =
      url.searchParams.get("v")?.match(/^([a-z0-9-]+)\.([0-9a-f]+)$/) ?? [];
    const current = owner ? versionOf(owner) : null;
    const atCurrent = !!current && current.version === version;
    const file = path.relative(base, filePath);
    if (atCurrent && file.startsWith(`resources${path.sep}`) && !current.resources.has(file)) {
      const missing = `${owner} ${version} ${file}`;
      if (!loggedMissing.has(missing)) {
        loggedMissing.add(missing);
        console.error(
          `${newErrorID()}: ${owner}'s version ${version} doesn't cover ${file}, which its ` +
            "page loaded; teach bin/version-games.js what names it"
        );
      }
    }

    const lastModified = new Date(Math.floor(info.mtimeMs / 1000) * 1000);
    const headers = {
      "Cache-Control": atCurrent
        ? "public, max-age=31536000, immutable"
        : owner
        ? "no-store"
        : cacheControl(url.pathname),
      "Last-Modified": lastModified.toUTCString(),
    };
    const since = Date.parse(request.headers["if-modified-since"] ?? "");
    if (!Number.isNaN(since) && lastModified.getTime() <= since) {
      response.writeHead(304, headers);
      return response.end();
    }

    response.writeHead(200, {
      ...headers,
      "Content-Type":
        contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
    });
    if (request.method === "HEAD") {
      return response.end();
    }
    createReadStream(filePath).pipe(response);
  };
}

function notFound(response) {
  response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
  response.end("404 page not found\n");
}

// fingerprinted matches the names bin/fingerprint.js gives files, with ten
// hex digits of their hash before their extension.
const fingerprinted = /\.[0-9a-f]{10}\.[a-z]+$/;

// cacheControl is how long browsers can keep the file at urlPath:
// - A fingerprinted file, one with a hash of what is in it in its name,
//   such as an app's bundle, dist/arcade.3f9a2c41d0.js, is kept for good,
//   since a file that changes gets a new name (see bin/fingerprint.js).
// - A page is never kept, so that it always names the latest fingerprinted
//   bundles.
// - Anything else, such as a scene or a model, which changes as it is
//   worked on, is kept but checked to still be current before it is used.
export function cacheControl(urlPath) {
  if (fingerprinted.test(urlPath)) {
    return "public, max-age=31536000, immutable";
  }
  if (urlPath.endsWith("/") || urlPath.endsWith(".html")) {
    return "no-store";
  }
  return "no-cache";
}
