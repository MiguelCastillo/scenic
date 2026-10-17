import {
  TextureVertexBufferData,
  VertexBuffer,
  VertexBufferData,
  VertexBufferIndexes,
} from "@scenic/renderer";
import {BoundingBox, Mesh} from "@scenic/scene";

import {shaderRegistry} from "./shader-registry.js";

// Terrain is ground that goes on forever: gentle, rounded hills rising out of
// flat meadows, grassy with patches of dirt, lit like any other mesh (see
// shaders/terrain.frag). Its height anywhere comes from a
// seeded noise, so the same settings always make the same hills, and only the
// ground around the camera is built, as square tiles, as far as the camera
// sees. Tiles are built as they come into view, the nearest first, and
// dropped once they are well behind, so the ground never ends however far
// anything flies. It lies at its transform's height and ignores its rotation
// and scale.
//
// heightAt(x, z) is the ground's height in the world under (x, z), for
// scripts to keep things on or above it, such as a ship flying over it (see
// the "ground" setting of games/bubble-squadron/scripts/fly.js).
//
// Its settings come from its state:
// - terrain.seed: which hills: each seed makes different ones.
// - terrain.height: how tall the tallest hills are.
// - terrain.scale: how far apart hills are, about.
// - terrain.flatness: how much of the ground is flat meadow between hills,
//   0 to 1. 0 is all hills, and the closer to 1, the fewer and smaller they
//   are.
// - terrain.clearings: places kept flat, such as around a race's gates, as a
//   list of [x, z, radius] in the world. The ground is flat out to radius and
//   rises back to its hills over as far again.
// - terrain.paths: valleys kept flat along lines, such as a race's course, as
//   a list of {points: [[x, z], ...], width} in the world. The ground is flat
//   within width / 2 of the line through the points, and rises back to its
//   hills over width beyond that. A closed path repeats its first point at
//   its end. A path with a dirtWidth has a dirt track that wide down its
//   middle.
// - terrain.bumps: small hills added on top of everything else, even in
//   clearings and along paths, such as to lift a race's gates, as a list of
//   [x, z, radius, height] in the world, for a round one. A long one adds
//   length and heading, [x, z, radius, height, length, heading]: it reaches
//   length out either way along heading, in degrees around the up axis from
//   +Z toward +X, and radius out to its sides.
// - terrain.lowColor, terrain.highColor: the grass in the meadows and on the
//   hilltops, as [r, g, b].
// - terrain.dirtColor: the dirt, as [r, g, b].
// - terrain.grassTexture, terrain.dirtTexture: grey detail textures for grass
//   and dirt, which their colors tint, repeated every grassSize and dirtSize
//   across the ground. See bin/generate-texture.js.
// - terrain.blendTexture: where dirt shows through grass, in its alpha,
//   repeated every blendSize.
// - terrain.tileSize: how big each tile is.
// - terrain.detail: how many steps a tile has along each side, up close.
// - terrain.detailDistance: how far from the camera tiles keep all their
//   detail. Out to twice as far they have half as many steps, and past that
//   a quarter, since far ground is small on screen and in the fog.
// - terrain.showTiles: whether to draw lines on the ground where its tiles'
//   edges are, and thinner ones around every square of their grids, to see
//   how the ground is cut up. Off by default.
//
// With "hud" in its state, such as {"hud": "terrain"}, it tells the app's UI
// what the ground costs every frame, on that channel of sceneManager.ui (see
// SceneManager in @scenic/scene): {tiles, drawn, triangles, built}, how many
// tiles it has, and how many it drew, their triangles, and how many it built
// in the last frame.
// Its material and ambient work as a mesh's do; the grass colors are vertex
// colors, which the material color adds to, so leave it black.
export class Terrain extends Mesh {
  static defaults = {
    seed: 1,
    height: 300,
    scale: 3000,
    flatness: 0.45,
    clearings: [],
    paths: [],
    bumps: [],
    lowColor: [0.45, 0.62, 0.42],
    highColor: [0.62, 0.8, 0.48],
    dirtColor: [0.62, 0.48, 0.34],
    grassTexture: "/resources/textures/terrain-grass.png",
    dirtTexture: "/resources/textures/terrain-dirt.png",
    blendTexture: "/resources/textures/terrain-blend.png",
    grassSize: 300,
    dirtSize: 300,
    blendSize: 9000,
    tileSize: 1000,
    detail: 16,
    detailDistance: 4000,
    showTiles: false,
  };

  // The settings that shape the ground, and its grass: changing any of them
  // changes every tile, so they are all built again. The others, such as the
  // textures and the dirt color, are only drawn.
  static shapedBy = [
    ...["seed", "height", "scale", "flatness", "clearings", "paths", "bumps"],
    ...["lowColor", "highColor", "tileSize", "detail", "detailDistance"],
  ];

  constructor(options) {
    super({...options, type: "terrain"});
    // The tiles built so far, by "column,row".
    this.tiles = new Map();
    // The terrain's settings, with defaults for those its state leaves out,
    // and the state they were worked out from (see prepareForView).
    this.settings = null;
    this.settingsFrom = null;
    // The settings that shape the ground, ready to measure (see withPieces).
    this.ground = null;
    // The index buffers tiles share, by how many steps they have.
    this.indexes = new Map();
    // The textures loaded so far, by URL.
    this.textures = new Map();
    // The tiles in view this frame, chosen by prepareForView.
    this.tilesToRender = [];
  }

  // heightAt is the height of the ground in the world under the world's
  // (x, z), from the settings of its last frame; it is flat until its first.
  // Matrix4 data is row-major, so positions are the last column of world
  // matrices.
  heightAt(x, z) {
    const o = this.worldMatrix.data;
    return o[7] + (this.ground ? height(this.ground, x - o[3], z - o[11]) : 0);
  }

  // isClear is whether the world's (x, z) is clear of the ground the terrain
  // keeps for something, such as a race's course: farther than margin past
  // the flat valley of every path and the flat middle of every clearing, and
  // off every bump. It is all clear until the terrain's first frame.
  isClear(x, z, margin = 0) {
    if (!this.ground) {
      return true;
    }
    const o = this.worldMatrix.data;
    const [lx, lz] = [x - o[3], z - o[11]];
    const {clearings, paths, bumps} = this.ground;
    return (
      clearings.every(([cx, cz, radius]) => Math.hypot(lx - cx, lz - cz) > radius + margin) &&
      paths.every(({pieces, width}) =>
        pieces.every(([a, b]) => distanceToSegment(lx, lz, a, b) > width / 2 + margin)
      ) &&
      bumps.every((bump) => bumpOutward(bump, lx, lz) > 1)
    );
  }

  // prepareForView builds the tiles that reach within the camera's far plane
  // of it, where it is this frame, nearest first, at the detail their
  // distance from it calls for, drops those beyond it, and chooses the ones
  // in view to draw, into tilesToRender.
  //
  // It replaces Mesh's prepareForView: the terrain's tiles aren't Geometry
  // children, and are checked against the view one by one (see below).
  prepareForView(context) {
    const {gl, sceneManager} = context;
    // Nothing is drawn until there is a camera to choose tiles for.
    this.tilesToRender = [];

    // The tiles are kept from frame to frame, built from the terrain's
    // settings, which live in its state. Its state can change on any frame,
    // and nothing tells the terrain, so it checks every frame. Its state
    // changes, for example, when:
    // - a setting is tuned live on the editor's Terrain tab, such as the
    //   height of the hills, or showTiles turned on;
    // - a script reshapes the ground, such as a game moving on to a level
    //   with other paths;
    // - the terrain is moved, which changes its state but not its settings.
    //
    // Any change to a node's state replaces its state object, keeping the
    // values that didn't change (see updateItemByID in StateManager), so
    // comparing the object tells whether anything changed, at the cost of
    // one comparison a frame. Only then are the settings worked out again,
    // and the tiles built again if one of the settings that shape the ground
    // changed (see shapedBy), and not for one that is only drawn, such as
    // showTiles.
    const state = sceneManager.getNodeStateByID(this.id);
    if (state !== this.settingsFrom) {
      const settings = {...Terrain.defaults, ...state.terrain};
      if (!this.settings || Terrain.shapedBy.some((key) => settings[key] !== this.settings[key])) {
        this.disposeTiles();
        this.ground = withPieces(settings);
      }
      this.settings = settings;
      this.settingsFrom = state;
    }

    const {tileSize, detail, detailDistance} = this.settings;

    // The tiles that reach within the camera's far plane of it, nearest
    // first. Tiles more than one tile farther away than that are dropped.
    const viewport = this.getViewport();
    const camera = viewport?.activeCamera;
    if (!camera) {
      return;
    }
    const far = sceneManager.getNodeStateByID(camera.id).projection?.far || 10000;
    const c = camera.worldMatrix.data;
    const o = this.worldMatrix.data;
    const [cx, cz] = [(c[3] - o[3]) / tileSize, (c[11] - o[11]) / tileSize];
    const reach = Math.ceil(far / tileSize);

    for (const [key, tile] of this.tiles) {
      if (Math.max(Math.abs(tile.column + 0.5 - cx), Math.abs(tile.row + 0.5 - cz)) > reach + 1) {
        tile.dispose();
        this.tiles.delete(key);
      }
    }

    // stepsAt is how many steps a tile has at distance tiles from the
    // camera: all of detail up close, then half, then a quarter.
    const stepsAt = (distance) => {
      const level = Math.min(2, Math.floor((distance * tileSize) / detailDistance));
      return Math.max(4, detail >> level);
    };

    // The tiles missing, and the tiles that have moved far enough into
    // another's distance to change how many steps they have. A quarter of a
    // tile's margin either side of where that changes keeps a tile from
    // being built again and again as the camera moves back and forth there.
    const wanted = [];
    for (let column = Math.floor(cx) - reach; column <= Math.floor(cx) + reach; column++) {
      for (let row = Math.floor(cz) - reach; row <= Math.floor(cz) + reach; row++) {
        const distance = Math.hypot(column + 0.5 - cx, row + 0.5 - cz);
        const tile = this.tiles.get(`${column},${row}`);
        const steps = stepsAt(distance);
        const settled = stepsAt(distance - 0.25) === steps && stepsAt(distance + 0.25) === steps;
        if (distance <= reach + 0.75 && (!tile || (tile.steps !== steps && settled))) {
          wanted.push({column, row, distance, steps});
        }
      }
    }

    // Building tiles for only a few milliseconds a frame keeps flying smooth
    // while the ground fills in, a tile at least. A tile changing its steps
    // is drawn as it was until its new one is built.
    wanted.sort((a, b) => a.distance - b.distance);
    const start = performance.now();
    let built = 0;
    for (const {column, row, steps} of wanted) {
      const key = `${column},${row}`;
      this.tiles.get(key)?.dispose();
      this.tiles.set(key, this.buildTile(gl, column, row, steps));
      built++;
      if (performance.now() - start > 4) {
        break;
      }
    }

    // It draws only the tiles in view. The tiles are spread all around the
    // camera, so one bounding volume around all of them would always be in
    // view, and would leave nothing out. Instead, each tile is checked on
    // its own, by the bounding volume it measured when it was built (see
    // buildTile).
    this.tilesToRender = [...this.tiles.values()].filter(({boundingVolume}) =>
      viewport.canSeeBoundingVolume(boundingVolume, this.worldMatrix)
    );
    // With tiles in view, it is drawn by its viewport, like any mesh (see
    // render in Viewport).
    if (this.tilesToRender.length && this.shaderProgram) {
      viewport.renderablesInView.push(this);
    }

    // What the ground cost, for the app's UI.
    const {hud} = sceneManager.getNodeStateByID(this.id);
    if (hud) {
      sceneManager.ui.publish(hud, {
        tiles: this.tiles.size,
        drawn: this.tilesToRender.length,
        triangles: this.tilesToRender.reduce(
          (sum, tile) => sum + tile.vertexBuffer.indexes.data.length / 3,
          0
        ),
        built,
      });
    }
  }

  // buildTile builds the tile in the given column and row: a grid of steps
  // along each side, its normals from the heights around each point, its
  // colors from how high each point is, and in its texture coordinates, how
  // much of a dirt track is at each point and the tile's steps. A skirt
  // hangs down from its edges, so that where it meets a tile with more or
  // fewer steps, whose edge doesn't quite line up with its own, the ground
  // has no cracks.
  buildTile(gl, column, row, detail) {
    const {tileSize, lowColor, highColor} = this.settings;
    const step = tileSize / detail;
    const [x0, z0] = [column * tileSize, row * tileSize];

    // Only the pieces of paths near the tile can change it, which is far
    // fewer to measure every point against than the whole of a long path.
    const settings = withPieces(this.settings, [
      x0 - step,
      z0 - step,
      x0 + tileSize + step,
      z0 + tileSize + step,
    ]);

    // Heights one step past each edge too, for the normals along it.
    const size = detail + 3;
    const heights = new Float32Array(size * size);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        heights[i * size + j] = height(settings, x0 + (j - 1) * step, z0 + (i - 1) * step);
      }
    }

    const positions = [];
    const normals = [];
    const colors = [];
    const tracks = [];
    for (let i = 0; i <= detail; i++) {
      for (let j = 0; j <= detail; j++) {
        const at = (di, dj) => heights[(i + 1 + di) * size + (j + 1 + dj)];
        const y = at(0, 0);
        positions.push(x0 + j * step, y, z0 + i * step);
        const normal = [at(0, -1) - at(0, 1), 2 * step, at(-1, 0) - at(1, 0)];
        const length = Math.hypot(...normal);
        normals.push(...normal.map((v) => v / length));
        // Flat ground, with no height, is all meadow.
        const t = settings.height > 0 ? Math.min(1, Math.max(0, y / settings.height)) ** 0.7 : 0;
        colors.push(...lowColor.map((v, k) => v + (highColor[k] - v) * t));
        tracks.push(track(settings, x0 + j * step, z0 + i * step), detail);
      }
    }

    // The skirt is a copy of the edge's points, lowered, around the tile:
    // along its first row, its last column, its last row and its first
    // column, in that order (see skirtIndexes).
    const drop = skirtDepth(this.settings);
    for (const index of edgeIndexes(detail)) {
      positions.push(
        positions[index * 3],
        positions[index * 3 + 1] - drop,
        positions[index * 3 + 2]
      );
      normals.push(...normals.slice(index * 3, index * 3 + 3));
      colors.push(...colors.slice(index * 3, index * 3 + 3));
      tracks.push(...tracks.slice(index * 2, index * 2 + 2));
    }

    if (!this.indexes.has(detail)) {
      this.indexes.set(detail, new VertexBufferIndexes(gl, tileIndexes(detail)));
    }

    const vertexBuffer = new VertexBuffer({
      positions: new VertexBufferData(gl, positions),
      normals: new VertexBufferData(gl, normals),
      colors: new VertexBufferData(gl, colors),
      textureCoords: new TextureVertexBufferData(gl, tracks),
      indexes: this.indexes.get(detail),
    });

    // Index buffers are shared by every tile with as many steps, so a tile
    // only deletes its own buffers. Its bounding volume is measured now, for
    // checking it against the view every frame.
    return {
      column,
      row,
      steps: detail,
      vertexBuffer,
      boundingVolume: BoundingBox.around(positions),
      dispose: () =>
        ["positions", "normals", "colors", "textureCoords"].forEach((b) =>
          vertexBuffer[b].dispose()
        ),
    };
  }

  // getMaterialsState gives terrain a dull material when its state has none,
  // since programs keep uniform values between meshes.
  getMaterialsState(context) {
    const state = context.sceneManager.getNodeStateByID(this.id);
    return {
      material: {color: [0, 0, 0, 1], reflectiveness: 1, specular: 0.05, shininess: 8},
      ambient: {color: [0.4, 0.4, 0.43]},
      ...(state.material && {material: state.material}),
      ...(state.ambient && {ambient: state.ambient}),
    };
  }

  // draw draws the tiles in tilesToRender, all at the terrain's world
  // matrix, since each tile's positions are already where it goes in the
  // terrain. It draws with the terrain's textures, loading them the first
  // time they are needed. Its viewport calls it, like a mesh's render.
  render(context) {
    const {settings, shaderProgram, tilesToRender} = this;

    const samplers = [
      ["grassTexture", settings.grassTexture, [204, 204, 204, 255]],
      ["dirtTexture", settings.dirtTexture, [204, 204, 204, 255]],
      ["blendTexture", settings.blendTexture, [255, 255, 255, 0]],
    ];
    const floatUniform = (name, value) => ({
      name,
      update: (gl, {index}) => gl.uniform1f(index, value),
    });
    const lightsState = this.getLightsState(context);
    if (lightsState) {
      Mesh.configureLighting(shaderProgram, lightsState);
    }
    const {material, ambient} = this.getMaterialsState(context);
    Mesh.configureMaterial(shaderProgram, material, ambient);

    const projectionMatrix = this.getViewProjectionMatrix();
    const worldMatrix = this.worldMatrix;
    const program = shaderProgram.addUniforms([
      {
        name: "projectionMatrix",
        update: (gl, {index}) => gl.uniformMatrix4fv(index, false, projectionMatrix.data),
      },
      {
        name: "worldMatrix",
        update: (gl, {index}) => gl.uniformMatrix4fv(index, true, worldMatrix.data),
      },
      ...this.getViewUniforms(),
      ...samplers.map(([name, url, placeholder], unit) => ({
        name,
        update: (gl, {index}) => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, this.getTexture(gl, url, placeholder));
          gl.uniform1i(index, unit);
        },
      })),
      floatUniform("grassSize", settings.grassSize),
      floatUniform("dirtSize", settings.dirtSize),
      floatUniform("blendSize", settings.blendSize),
      floatUniform("tileSize", settings.tileSize),
      {name: "showTiles", update: (gl, {index}) => gl.uniform1i(index, !!settings.showTiles)},
      {name: "dirtColor", update: (gl, {index}) => gl.uniform3fv(index, settings.dirtColor)},
    ]);

    program.use();
    tilesToRender.forEach((tile) => program.draw(tile.vertexBuffer));
    program.release();
  }

  // getTexture is the texture at url, which repeats, with placeholder, an
  // [r, g, b, a] pixel, in its place until it has loaded.
  getTexture(gl, url, placeholder) {
    if (!this.textures.has(url)) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(placeholder)
      );
      this.textures.set(url, texture);

      const image = new Image();
      image.onload = () => {
        // The texture may have been deleted while the image loaded, when the
        // terrain was disposed.
        if (!gl.isTexture(texture)) {
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        // Ground is mostly seen at a slant, which blurs textures without
        // anisotropic filtering.
        const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
        if (anisotropic) {
          gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, 8);
        }
      };
      image.src = url;
    }
    return this.textures.get(url);
  }

  disposeTiles() {
    for (const tile of this.tiles.values()) {
      tile.dispose();
    }
    this.tiles.clear();
    for (const indexes of this.indexes.values()) {
      indexes.dispose();
    }
    this.indexes.clear();
  }

  dispose(gl) {
    this.disposeTiles();
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }
    this.textures.clear();
    super.dispose(gl);
  }
}

// edgeIndexes are the points around the edge of a tile with detail steps,
// once each: along its first row, down its last column, back along its last
// row and up its first column, in a loop.
function edgeIndexes(detail) {
  const row = detail + 1;
  const edge = [];
  for (let j = 0; j < detail; j++) {
    edge.push(j);
  }
  for (let i = 0; i < detail; i++) {
    edge.push(i * row + detail);
  }
  for (let j = detail; j > 0; j--) {
    edge.push(detail * row + j);
  }
  for (let i = detail; i > 0; i--) {
    edge.push(i * row);
  }
  return edge;
}

// tileIndexes are the triangles of a tile with detail steps: two for each
// square of its grid, and two for each step of its skirt, which follows the
// grid's points in the order edgeIndexes lists them. The skirt is drawn from
// both sides, since it is seen from outside the tile wherever it shows.
function tileIndexes(detail) {
  const row = detail + 1;
  const indexes = [];
  for (let i = 0; i < detail; i++) {
    for (let j = 0; j < detail; j++) {
      const a = i * row + j;
      indexes.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const edge = edgeIndexes(detail);
  const skirt = row * row;
  edge.forEach((top, k) => {
    const next = (k + 1) % edge.length;
    const [a, b, c, d] = [top, edge[next], skirt + k, skirt + next];
    indexes.push(a, c, b, b, c, d, a, b, c, b, d, c);
  });
  return indexes;
}

// skirtDepth is how far a tile's skirt hangs below its edge: deeper for
// taller hills, where tiles with different steps can be further apart.
function skirtDepth(settings) {
  return 20 + settings.height * 0.1;
}

// withPieces is settings with each path's line also as its pieces, the pairs
// of points that make it up, which height and track measure against. Given
// bounds, [x0, z0, x1, z1], it keeps only the pieces close enough to the
// bounds to change anything inside them.
function withPieces(settings, bounds) {
  const paths = settings.paths.map((path) => {
    const reach = Math.max(path.width * 1.5, (path.dirtWidth || 0) / 2 + 100);
    const pieces = [];
    for (let i = 1; i < path.points.length; i++) {
      const [[ax, az], [bx, bz]] = [path.points[i - 1], path.points[i]];
      const near =
        !bounds ||
        (Math.min(ax, bx) - reach < bounds[2] &&
          Math.max(ax, bx) + reach > bounds[0] &&
          Math.min(az, bz) - reach < bounds[3] &&
          Math.max(az, bz) + reach > bounds[1]);
      if (near) {
        pieces.push([path.points[i - 1], path.points[i]]);
      }
    }
    return {...path, pieces};
  });
  return {...settings, paths};
}

// height is the terrain's height at (x, z) in its own space: a few layers of
// noise, the meadows between hills cut flat by flatness, then flattened
// around the clearings and along the paths, and then with the bumps on top.
function height({seed, height, scale, flatness, clearings, paths, bumps}, x, z) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1 / scale;
  for (let octave = 0; octave < 3; octave++) {
    sum += amplitude * noise(x * frequency, z * frequency, seed + octave * 17);
    amplitude /= 2;
    frequency *= 2;
  }
  // The three layers add up to at most 0.875.
  let h = height * smoothstep(flatness, 1, sum / 0.875);
  for (const [cx, cz, radius] of clearings) {
    h *= smoothstep(radius, 2 * radius, Math.hypot(x - cx, z - cz));
  }
  for (const {pieces, width} of paths) {
    let distance = Infinity;
    for (const [a, b] of pieces) {
      distance = Math.min(distance, distanceToSegment(x, z, a, b));
    }
    h *= smoothstep(width / 2, width * 1.5, distance);
  }
  // A bump is level at its top and its foot, so it rises smoothly out of the
  // ground around it.
  for (const bump of bumps) {
    const t = Math.min(1, bumpOutward(bump, x, z));
    h += bump[3] * (1 - t * t) ** 2;
  }
  return h;
}

// bumpOutward is how far out from a bump's middle (x, z) is: 0 at its
// middle, 1 at its foot, and more past it.
function bumpOutward([bx, bz, radius, , length = radius, heading = 0], x, z) {
  const angle = (heading * Math.PI) / 180;
  const [dx, dz] = [x - bx, z - bz];
  const along = dx * Math.sin(angle) + dz * Math.cos(angle);
  const across = dx * Math.cos(angle) - dz * Math.sin(angle);
  return Math.hypot(along / length, across / radius);
}

// track is how much of a dirt track is at (x, z), from 0 to 1: 1 within
// dirtWidth / 2 of a path that has one, fading out a little past that.
function track({paths}, x, z) {
  let amount = 0;
  for (const {pieces, dirtWidth} of paths) {
    if (dirtWidth) {
      let distance = Infinity;
      for (const [a, b] of pieces) {
        distance = Math.min(distance, distanceToSegment(x, z, a, b));
      }
      amount = Math.max(amount, 1 - smoothstep(dirtWidth / 2 - 100, dirtWidth / 2 + 100, distance));
    }
  }
  return amount;
}

// distanceToSegment is how far (x, z) is from the line segment from a to b.
function distanceToSegment(x, z, [ax, az], [bx, bz]) {
  const [dx, dz] = [bx - ax, bz - az];
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

// noise is smooth value noise at (x, z): random values at whole numbers,
// blended smoothly in between, from 0 to 1.
function noise(x, z, seed) {
  const [ix, iz] = [Math.floor(x), Math.floor(z)];
  const [fx, fz] = [x - ix, z - iz];
  const [ux, uz] = [fade(fx), fade(fz)];
  const a = random(ix, iz, seed);
  const b = random(ix + 1, iz, seed);
  const c = random(ix, iz + 1, seed);
  const d = random(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function random(x, z, seed) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

shaderRegistry.register(Terrain, "shaders/terrain");
