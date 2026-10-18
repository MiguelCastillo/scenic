// rooms makes rooms for races and says what is in them, at /rooms/, so that
// players can race together without sharing links: one starts a new race
// and reads its code out to the others, who join it by typing the code, or
// anyone auto joins and is put in a race on the same track with a seat for
// them. A room's code is its name, which players then join at /ws (see
// Relay). It is a request handler for relay's rooms, (request, response) =>
// {}. Every request and response is JSON:
//
//   - POST /rooms/new {"game", "scene"}: makes a room for a race of game's
//     scene, such as "bubble-squadron" and "race.json", which only those who
//     know its code can join, and returns {"code"}.
//   - POST /rooms/auto {"game", "scene"}: returns {"code"} of a room for a
//     race of game's scene that anyone can be put in and has a seat free,
//     the fullest one, so that races fill up, or of a new one.
//   - GET /rooms/{code}: returns {"code", "game", "scene", "players",
//     "full"}, what the room's race is, how many are in it, and whether it
//     has no seat free, or 404 when there is no such room.
//
// Codes are four capitals without I and O, such as "KXQM", and a code in a
// request can be in any case.
export function rooms(relay) {
  return async (request, response) => {
    const kind = new URL(request.url, "http://localhost").pathname.replace(/^\/rooms\//, "");
    if (request.method === "POST" && (kind === "new" || kind === "auto")) {
      let race = null;
      try {
        race = JSON.parse(await readBody(request));
      } catch {
        // Not JSON, which is answered below.
      }
      if (!race?.game || !race?.scene) {
        return answer(response, 400, "a race needs a game and a scene");
      }
      return answerJSON(response, {code: relay.roomFor(race.game, race.scene, kind === "auto")});
    }
    if (request.method === "GET" && kind) {
      const info = relay.roomInfo(kind.toUpperCase());
      return info ? answerJSON(response, info) : answer(response, 404, "no race with that code");
    }
    answer(response, 404, "404 page not found");
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function answerJSON(response, value) {
  response.writeHead(200, {"Content-Type": "application/json"});
  response.end(JSON.stringify(value));
}

function answer(response, status, text) {
  response.writeHead(status, {"Content-Type": "text/plain; charset=utf-8"});
  response.end(`${text}\n`);
}
