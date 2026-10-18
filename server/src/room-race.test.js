import path from "node:path";

import {join, startServer} from "./test-server.js";

// newRace makes a room for a race of Bubble Squadron's race.json on the test
// server, and returns its code.
async function newRace(server) {
  const response = await fetch(`${server.url}/rooms/new`, {
    method: "POST",
    body: JSON.stringify({game: "bubble-squadron", scene: "race.json"}),
  });
  return (await response.json()).code;
}

describe("RoomRace", () => {
  let server;
  afterEach(() => server?.stop());

  test("seats its players, fills the rest with NPCs, and starts once all are ready", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    const code = await newRace(server);
    const {player: a} = await join(server, code);
    a.say({ship: "saucer", ready: false});

    const seated = await a.nextWhere(
      ({type, you, ships}) => type === "race" && you && Object.keys(ships).length === 6
    );
    expect(seated).toMatchObject({
      number: 1,
      started: false,
      lobby: {players: 1, ready: 0},
      you: {name: "p1", id: "p1 starfighter"},
    });
    expect(seated.ships.p1).toMatchObject({ship: "saucer", label: "Saucer"});
    expect(seated.race.standings).toHaveLength(6);

    // Someone else comes in, and takes an NPC's seat.
    const {player: b} = await join(server, code);
    b.say({ship: "dart", ready: false});
    const full = await a.nextWhere(({ships}) => ships?.p2 && Object.keys(ships).length === 6);
    expect(full.ships.p2).toMatchObject({ship: "dart", label: "Dart"});
    expect(Object.keys(full.ships).filter((name) => name.startsWith("npc"))).toHaveLength(4);

    // The race waits for everyone.
    a.say({ship: "saucer", ready: true});
    const waiting = await a.nextWhere(({lobby}) => lobby.ready === 1);
    expect(waiting.started).toBe(false);
    b.say({ship: "dart", ready: true});
    const started = await a.nextWhere(({started}) => started);
    expect(started.lobby).toEqual({players: 2, ready: 2});
    const countingDown = await a.nextWhere(({race}) => race.countdown < 5);
    expect(countingDown.race.waitingForPlayers).toBe(false);
  });

  test("loads the next race once everyone racing wants it", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    const code = await newRace(server);
    const {player} = await join(server, code);
    player.say({ship: "saucer", ready: true});
    await player.nextWhere(({started}) => started);

    player.say({ship: "saucer", ready: true, race: 2});
    const next = await player.nextWhere(({number}) => number === 2);
    expect(next.started).toBe(false);
    const again = await player.nextWhere(({number, started}) => number === 2 && started);
    expect(again.you).toMatchObject({name: "p1"});
  });

  test("answers with the last thing the player said, and where their ship is", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    const code = await newRace(server);
    const {player} = await join(server, code);
    player.say({ship: "saucer", ready: true, seq: 7});

    const {you} = await player.nextWhere(({you}) => you?.ack === 7);
    expect(you.ackAge).toBeGreaterThanOrEqual(0);
    expect(you.ship).toMatchObject({held: true, lap: 0});
    expect(you.ship.transform.position).toHaveLength(3);
    expect(you.ship.settings.boostSpeed).toBeGreaterThan(0);
  });

  test("gives a player's keys to their ship", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    const code = await newRace(server);
    const {player} = await join(server, code);
    player.say({ship: "saucer", ready: true});
    await player.nextWhere(({started}) => started);

    // Space opens the throttle, even while held at the start.
    const before = (await player.nextWhere(({ships}) => ships.p1?.throttle != null)).ships.p1;
    player.say({ship: "saucer", ready: true, keys: ["Space"]});
    const revved = await player.nextWhere(({ships}) => ships.p1.throttle > before.throttle + 0.2);
    expect(revved.ships.p1.throttle).toBeGreaterThan(before.throttle);
  });
});
