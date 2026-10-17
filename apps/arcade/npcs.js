import {mat4} from "@scenic/math";
import {replaceShip} from "./ships.js";

// addNPCs puts racers the computer plays into the scene the player plays
// alone, beside the player, as the game's manifest says in "npcs":
// {count, pilot, scenes}, how many, the script that flies them, relative to
// the scene file like the scene's own, and the scene files that have them,
// such as ["race.json"] (see games/README.md).
//
// Each NPC is a copy of the node that is the player in the scene, whatever it
// is, such as a ship, with its own script, such as fly.js, and collider,
// playing on an input channel of its own, such as "npc 1", which its
// "input" names. Beside it, a node of its own runs the pilot, which plays
// it by pressing keys on that channel, the way a player's keyboard would. A
// pilot's settings say which node it flies, as ship, and how well, as
// skill, from 0 to 1, which the NPCs spread from fair to very good. In a
// game with ships to choose from, each NPC flies one at random, other than
// the player's, and no two the same while there are enough.
//
// NPCs line up in pairs beside and behind the player, across and back from
// where the player faces.
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
  const {count = 0, pilot} = npcs;
  const {sceneManager} = scene;
  const parentID = sceneManager.getNodeByID(playerNodeID).parent.id;
  // eslint-disable-next-line no-unused-vars
  const {id, hud, network, held, items, ...look} = sceneManager.getNodeStateByID(playerNodeID);
  const {position, rotation} = look.transform;
  const turned = mat4.rotate(mat4.identity(), ...rotation);
  // Matrix4 data is row-major, so the player's axes are its columns.
  const across = [turned[0], turned[4], turned[8]];
  const ahead = [turned[2], turned[6], turned[10]];

  // The other ships, shuffled, to deal out.
  const otherShips = (ships?.list.filter((ship) => ship.id !== playerShip) ?? [])
    .map((ship) => ({ship, order: Math.random()}))
    .sort((a, b) => a.order - b.order)
    .map(({ship}) => ship);
  await Promise.all(
    Array.from({length: count}, async (_, i) => {
      const name = `npc ${i + 1}`;
      // Pairs on either side, each pair further back than the last.
      const row = Math.floor(i / 2);
      const side = i % 2 ? -1 : 1;
      const [x, back] = [side * (row ? 225 : 450), row * 500];
      const ship = otherShips.length ? otherShips[i % otherShips.length] : null;

      const nodeID = await scene.add(
        {
          ...look,
          ...(!ship && {items}),
          input: name,
          transform: {
            ...look.transform,
            position: position.map((v, j) => v + across[j] * x - ahead[j] * back),
          },
        },
        {parentID, idPrefix: `${name} `}
      );
      if (ship) {
        await replaceShip(scene, nodeID, await ships.shipConfig(ship.id));
      }
      await scene.add(
        {
          name: "pilot",
          type: "transform",
          script: {
            src: pilot,
            settings: {ship: nodeID, skill: count > 1 ? 0.5 + (0.45 * i) / (count - 1) : 0.7},
          },
        },
        {parentID, idPrefix: `${name} `}
      );
    })
  );
}
