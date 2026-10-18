import {mat4} from "@scenic/math";
import {replaceShip} from "./ships.js";

// NPCs are racers the computer plays, as the game's manifest says in "npcs":
// {racers, pilot, scenes}, the most racers in a race, the player included,
// whose seats the NPCs fill, the script that flies them, relative to the
// scene file like the scene's own, and the scene files that have them, such
// as ["race.json"] (see games/README.md).
//
// Each NPC is a copy of the node that is the player in the scene, whatever it
// is, such as a ship, with its own script, such as fly.js, and collider,
// playing on an input channel of its own, such as "npc 1", which its
// "input" names. Beside it, a node of its own runs the pilot, which plays
// it by pressing keys on that channel, the way a player's keyboard would. A
// pilot's settings say which node it flies, as ship, what it is called, as
// name, its ship's name or "NPC 1", and how well it flies, as skill, from 0
// to 1, which NPCs spread from fair to very good. In a game with ships to
// choose from, each NPC flies one at random, other than the player's, and no
// two the same while there are enough (see dealShips).

// addNPCs puts NPCs in the scene the player plays alone, racers - 1 of them,
// such as 5 in a race of 6, behind the player on the starting grid, from its
// second place on (see gridPosition).
//
// Options:
// - playerNodeID: the id of the node that is the player in the scene, such
//   as "starfighter".
// - npcs: the manifest's "npcs".
// - ships: the game's ships (see Ships), for a game with ships to choose
//   from.
// - playerShip: the id of the ship the player flies, if they chose one.
//
// It resolves once every NPC is in the scene, ship and all.
export async function addNPCs(scene, {playerNodeID, npcs, ships = null, playerShip = null}) {
  const count = Math.max(0, (npcs.racers ?? 1) - 1);
  const gridStart = scene.sceneManager.getNodeStateByID(playerNodeID).transform;
  const dealt = dealShips(ships, playerShip);
  await Promise.all(
    Array.from({length: count}, (_, i) =>
      addNPC(scene, {
        playerNodeID,
        pilot: npcs.pilot,
        number: i + 1,
        position: gridPosition(gridStart, i + 1),
        ship: dealt.length ? dealt[i % dealt.length] : null,
        ships,
        skill: count > 1 ? 0.5 + (0.45 * i) / (count - 1) : 0.7,
      })
    )
  );
}

// addNPC puts one NPC in the scene, and resolves with it, once it is in the
// scene, ship and all, as {name, label, ship, shipNodeID, pilotNodeID}: its
// input channel, such as "npc 1", what it is called, the id of the ship it
// flies, if the game has ships, and the ids of its nodes, to move or remove
// it (see removeNPC).
//
// Options:
// - playerNodeID: the id of the node that is the player in the scene, which
//   the NPC is a copy of.
// - pilot: the script that flies it.
// - number: which NPC it is, from 1, which names it, such as "npc 1", so
//   each NPC in a scene needs its own.
// - position: where it starts.
// - ship: the ship it flies, as {id, label}, or null to fly the player's.
// - ships: the game's ships (see Ships), for a game with ships.
// - skill: how well it flies, from 0 to 1.
// - network: whether its node publishes where it is, on the network channel
//   named after it, such as "npc 1", for the other players in a room, the
//   way the player's does. false by default.
export async function addNPC(
  scene,
  {playerNodeID, pilot, number, position, ship = null, ships = null, skill, network = false}
) {
  const {sceneManager} = scene;
  const parentID = sceneManager.getNodeByID(playerNodeID).parent.id;
  const name = `npc ${number}`;
  const label = ship?.label ?? `NPC ${number}`;
  // The NPC's node is the player's, without what makes it the player's: its
  // id, its HUD, its network channel, and how it is doing in the race.
  const {items, ...look} = sceneManager.getNodeStateByID(playerNodeID);
  for (const key of ["id", "hud", "held", "lap", "network"]) {
    delete look[key];
  }
  const shipNodeID = await scene.add(
    {
      ...look,
      ...(!ship && {items}),
      ...(network && {network: name}),
      input: name,
      transform: {...look.transform, position},
    },
    {parentID, idPrefix: `${name} `}
  );
  if (ship) {
    await replaceShip(scene, shipNodeID, await ships.shipConfig(ship.id));
  }
  const pilotNodeID = await scene.add(
    {
      name: "pilot",
      type: "transform",
      script: {src: pilot, settings: {ship: shipNodeID, name: label, skill}},
    },
    {parentID, idPrefix: `${name} `}
  );
  return {name, label, ship: ship?.id ?? null, shipNodeID, pilotNodeID};
}

// removeNPC takes an NPC added by addNPC out of the scene.
export function removeNPC(scene, {shipNodeID, pilotNodeID}) {
  scene.remove(pilotNodeID);
  scene.remove(shipNodeID);
}

// dealShips is the game's ships, other than playerShip, the one the player
// flies, shuffled, to deal out to NPCs in turn, or none in a game without
// ships to choose from.
export function dealShips(ships, playerShip) {
  return (ships?.list.filter((ship) => ship.id !== playerShip) ?? [])
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
