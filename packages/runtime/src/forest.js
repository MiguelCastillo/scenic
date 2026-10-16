import {mat4} from "@scenic/math";
import {Mesh, Node, Viewport} from "@scenic/scene";

// Forest plants trees across a terrain as far as anything can see: wherever
// the camera goes, the ground around it is full of trees, and none of them
// are stored. The ground is cut into square tiles, like the terrain's, and
// each tile's trees come from the forest's seed and the tile, so the same
// ground always grows the same trees. Tiles are planted as they come within
// the forest's distance of the camera, the nearest first, a few milliseconds'
// worth a frame, and dropped once they are well behind.
//
// Its children are the kinds of tree it plants: static meshes, each with its
// resource and its lods (see a static mesh's lods in the README), material and
// ambient, like any other. A tree is one of them, picked at random, and the
// forest has each draw at all of its trees (see instances in Mesh) instead of
// where it is. Trees stand on the terrain, and keep out of the ground it
// keeps for something else, such as a race's course (see isClear in
// Terrain), so they are never in the way. The forest plants in the world,
// whatever its transform.
//
// Its settings come from its state:
// - forest.terrain: the ID of the terrain the trees stand on.
// - forest.seed: which trees: each seed plants different ones.
// - forest.density: how many trees grow in a square 1000 on a side, on
//   average.
// - forest.distance: how far from the camera there are trees.
// - forest.margin: how much farther than the ground the terrain keeps clear
//   trees stay, such as off to the sides of a race's valley.
// - forest.minScale, forest.maxScale: how big trees are, from their meshes'
//   size, picked between these for each tree.
// - forest.tileSize: how big each tile of trees is.
export class Forest extends Node {
  static defaults = {
    terrain: "terrain",
    seed: 1,
    density: 6,
    distance: 9000,
    margin: 150,
    minScale: 0.45,
    maxScale: 0.75,
    tileSize: 2000,
  };

  constructor(options) {
    super({...options, type: "forest"});
    // The tiles planted so far, by "column,row", each a list of its trees,
    // {kind, matrix}, and the settings and ground they were planted for, to
    // plant them all again when either changes.
    this.tiles = new Map();
    this.plantedFor = "";
  }

  preRender(context) {
    super.preRender(context);
    const {sceneManager} = context;
    const settings = {...Forest.defaults, ...sceneManager.getNodeStateByID(this.id).forest};
    const kinds = this.items.filter((child) => child instanceof Mesh);
    const terrain = sceneManager.getNodeByID(settings.terrain);
    const camera = Node.findParentByType(this, Viewport)?.activeCamera;

    // Until the terrain has its ground, after its first frame, there is
    // nowhere to stand.
    if (!terrain?.ground || !camera || !kinds.length) {
      kinds.forEach((kind) => (kind.instances = []));
      return;
    }

    const plantedFor = JSON.stringify([settings, kinds.length, terrain.builtWith]);
    if (plantedFor !== this.plantedFor) {
      this.tiles.clear();
      this.plantedFor = plantedFor;
    }

    // Matrix4 data is row-major, so positions are the last column of world
    // matrices.
    const {tileSize, distance} = settings;
    const c = camera.worldMatrix.data;
    const [cx, cz] = [c[3] / tileSize, c[11] / tileSize];
    const reach = Math.ceil(distance / tileSize);

    for (const key of this.tiles.keys()) {
      const [column, row] = key.split(",").map(Number);
      if (Math.max(Math.abs(column + 0.5 - cx), Math.abs(row + 0.5 - cz)) > reach + 1) {
        this.tiles.delete(key);
      }
    }

    const wanted = [];
    for (let column = Math.floor(cx) - reach; column <= Math.floor(cx) + reach; column++) {
      for (let row = Math.floor(cz) - reach; row <= Math.floor(cz) + reach; row++) {
        const away = Math.hypot(column + 0.5 - cx, row + 0.5 - cz);
        if (away <= reach + 0.75 && !this.tiles.has(`${column},${row}`)) {
          wanted.push({column, row, away});
        }
      }
    }

    // Planting for only a few milliseconds a frame keeps flying smooth while
    // the trees fill in, a tile at least.
    wanted.sort((a, b) => a.away - b.away);
    const start = performance.now();
    for (const {column, row} of wanted) {
      this.tiles.set(`${column},${row}`, plant(column, row, settings, terrain, kinds.length));
      if (performance.now() - start > 2) {
        break;
      }
    }

    // Each kind draws at its trees.
    const instances = kinds.map(() => []);
    for (const trees of this.tiles.values()) {
      for (const {kind, matrix} of trees) {
        instances[kind].push(matrix);
      }
    }
    kinds.forEach((kind, i) => (kind.instances = instances[i]));
  }
}

// plant is the trees of the tile in column and row: about density in each
// square 1000 on a side, each a kind of tree out of kinds and a world matrix
// that stands it on the terrain, turned and sized at random. Trees that
// would stand on ground the terrain keeps clear are left out.
function plant(column, row, settings, terrain, kinds) {
  const {seed, density, margin, minScale, maxScale, tileSize} = settings;
  const random = mulberry32(hash(column, row, seed));
  const count = Math.floor(density * (tileSize / 1000) ** 2 + random());

  const trees = [];
  for (let i = 0; i < count; i++) {
    // Every tree takes its random numbers, even one left out, so that one
    // tree doesn't move the others.
    const [x, z] = [(column + random()) * tileSize, (row + random()) * tileSize];
    const scale = minScale + (maxScale - minScale) * random();
    const turn = random() * 360;
    const kind = Math.floor(random() * kinds);
    if (terrain.isClear(x, z, margin)) {
      // Trees sink a little into the ground, so they stand in it on a slope.
      const position = [x, terrain.heightAt(x, z) - 10 * scale, z];
      trees.push({kind, matrix: mat4.Matrix4.trs(position, [0, turn, 0], [scale, scale, scale])});
    }
  }
  return trees;
}

// hash is a whole number from a tile and a seed, to start its random numbers
// from.
function hash(column, row, seed) {
  let h = seed * 374761393 + column * 668265263 + row * 2147483647;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32 is a small random number generator: each call returns the next
// number from 0 to 1 after seed.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
