import {mat4} from "@scenic/math";
import {replaceShip} from "./ships.js";

// Racers are the ships in a race: the players', and NPCs, racers the
// computer plays, which fill every seat no player takes, as the game's
// manifest says in "npcs": {racers, pilot, scenes}, the most racers in a
// race, the script that flies NPCs, relative to the scene file like the
// scene's own, and the scene files that have races (see games/README.md).
//
// Every racer is a copy of the same node, the scene's player node, whatever
// it is, such as a ship, with its script, such as fly.js, and its collider,
// playing on an input channel of its own, its name, such as "p2" for a
// player or "npc 1" for an NPC, which its "input" names, and publishing
// where it is on the network channel of the same name. A player's keys go
// to its channel. An NPC has a node of its own beside it that runs its
// pilot, which plays it by pressing keys on that channel, the way a
// player's keyboard would. A pilot's settings say which node it flies, as
// ship, and how well it flies, as skill, from 0 to 1. In a game with ships
// to choose from, each racer flies one: a player the one they chose, and an
// NPC one dealt to it (see dealShips).

// racerTemplate is the node every racer in a scene is a copy of: the state
// of its player node, playerNodeID, such as "starfighter", without what
// makes it the player's: its id, its HUD, its network channel, and how it
// is doing in a race. Take it before the player node leaves the scene.
export function racerTemplate(sceneManager, playerNodeID) {
  const template = {...sceneManager.getNodeStateByID(playerNodeID)};
  for (const key of ["id", "hud", "held", "lap", "network"]) {
    delete template[key];
  }
  return template;
}

// addRacer puts a racer in the race, and resolves with it, once it is in the
// scene, ship and all, as {name, label, ship, shipNodeID, pilotNodeID}: its
// channel, what it is called, the id of the ship it flies, if the game has
// ships, and the ids of its nodes, to move or remove it (see removeRacer).
// It enters the race, with label for its name in the results.
//
// Options:
// - template: the node it is a copy of (see racerTemplate).
// - parentID: the id of the node to add it under, where the player node was.
// - name: its input and network channel, such as "p2" or "npc 1", which
//   every racer in the scene needs its own of.
// - label: what it is called in the race's results.
// - position: where it starts.
// - ship: the id of the ship it flies, or null to fly the template's.
// - ships: the game's ships (see Ships), for a game with ships.
// - pilot: the script that flies it, for an NPC, or null for a player.
// - skill: how well its pilot flies, from 0 to 1.
// - course: the id of the race's node, which it enters. "race" by default.
export async function addRacer(
  scene,
  {
    template,
    parentID,
    name,
    label,
    position,
    ship = null,
    ships = null,
    pilot = null,
    skill = 0.7,
    course = "race",
  }
) {
  const {sceneManager} = scene;
  const {items, ...look} = template;
  const shipNodeID = await scene.add(
    {
      ...look,
      ...(!ship && {items}),
      input: name,
      network: name,
      transform: {...look.transform, position},
    },
    {parentID, idPrefix: `${name} `}
  );
  if (ship) {
    await replaceShip(scene, shipNodeID, await ships.shipConfig(ship));
  }
  const pilotNodeID = pilot
    ? await scene.add(
        {
          name: "pilot",
          type: "transform",
          script: {src: pilot, settings: {ship: shipNodeID, skill, course}},
        },
        {parentID, idPrefix: `${name} `}
      )
    : null;

  const courseState = sceneManager.getNodeStateByID(course);
  if (courseState) {
    const race = courseState.script.settings;
    sceneManager.updateNodeStateByID(course, {
      script: {
        ...courseState.script,
        settings: {...race, entrants: [...(race.entrants ?? []), {id: shipNodeID, name: label}]},
      },
    });
  }
  return {name, label, ship, shipNodeID, pilotNodeID};
}

// removeRacer takes a racer added by addRacer out of the race, and out of
// the scene.
export function removeRacer(scene, {shipNodeID, pilotNodeID}, {course = "race"} = {}) {
  const {sceneManager} = scene;
  const courseState = sceneManager.getNodeStateByID(course);
  if (courseState) {
    const race = courseState.script.settings;
    sceneManager.updateNodeStateByID(course, {
      script: {
        ...courseState.script,
        settings: {...race, entrants: race.entrants.filter(({id}) => id !== shipNodeID)},
      },
    });
  }
  if (pilotNodeID) {
    scene.remove(pilotNodeID);
  }
  scene.remove(shipNodeID);
}

// dealShips is the game's ships, shuffled, to deal out to NPCs in turn, or
// none in a game without ships to choose from.
export function dealShips(ships) {
  return (ships?.list ?? [])
    .map((ship) => ({ship, order: Math.random()}))
    .sort((a, b) => a.order - b.order)
    .map(({ship}) => ship);
}

// gridPosition is where place, from 0, is on a race's starting grid, whose
// first place is at start, the transform of the player's node as the scene
// has it, {position, rotation}. Places after the first line up in pairs on
// either side of it, and then further back, each pair further back than the
// last, across and back from where the first faces.
export function gridPosition({position, rotation}, place) {
  if (place === 0) {
    return position;
  }
  const turned = mat4.rotate(mat4.identity(), ...rotation);
  // Matrix4 data is row-major, so the first place's axes are its columns.
  const across = [turned[0], turned[4], turned[8]];
  const ahead = [turned[2], turned[6], turned[10]];
  const i = place - 1;
  const row = Math.floor(i / 2);
  const side = i % 2 ? -1 : 1;
  const [x, back] = [side * (row ? 225 : 450), row * 500];
  return position.map((v, j) => v + across[j] * x - ahead[j] * back);
}
