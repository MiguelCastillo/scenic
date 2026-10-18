// Ships is a game's catalog of the ships players can choose from, read from
// the file the game's manifest names in "ships" (see games/README.md): a list
// of {id, label, src}, each ship's id, such as "saucer", what players see,
// and its file, relative to the catalog, which holds the ship's parts, such
// as its body and flames, under a node of their own.
//
// A ship is put on a node with replaceShip, so the same ship can fly as the
// player, show in the hangar, or fly as another player's copy.
//
// Its API: Ships.load(url), list, find(id), and shipConfig(id), which
// resolves with the ship's file, fetched once however often it is asked for.
export class Ships {
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`unable to load ${url.pathname}: ${response.status} ${response.statusText}`);
    }
    return new Ships(url, await response.json());
  }

  constructor(url, list) {
    this.list = list;
    this._url = url;
    this._configsByID = new Map();
  }

  find(id) {
    return this.list.find((ship) => ship.id === id);
  }

  shipConfig(id) {
    if (!this._configsByID.has(id)) {
      const ship = this.find(id);
      if (!ship) {
        return Promise.reject(new Error(`there is no ship "${id}"`));
      }
      this._configsByID.set(
        id,
        fetch(new URL(ship.src, this._url)).then((response) => {
          if (!response.ok) {
            throw new Error(`unable to load ship "${id}": ${response.status}`);
          }
          return response.json();
        })
      );
    }
    return this._configsByID.get(id);
  }
}

// replaceShip takes the parts off the node nodeID in scene (see loadScene in
// @scenic/runtime), such as a ship's body and flames, and puts shipConfig's
// on it instead, so the node flies, or shows, that ship. The node keeps its
// own state, such as its transform and its script, so a player's ship keeps
// flying the way it was. Its new parts' ids start with the node's, such as
// "starfighter body". It resolves once the ship's models are loaded.
export async function replaceShip(scene, nodeID, shipConfig) {
  const node = scene.sceneManager.getNodeByID(nodeID);
  [...node.items].forEach((part) => scene.remove(part.id));
  await scene.add(shipConfig, {parentID: nodeID, idPrefix: `${nodeID} `});
}
