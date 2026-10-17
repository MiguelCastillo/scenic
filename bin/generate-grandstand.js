#!/usr/bin/env node
// generate-grandstand writes a grandstand as an OBJ file: rows of empty
// seats climbing up and back on concrete steps, under a roof on posts, to
// stand beside a race track. The seats come in blocks of bright colors with
// a stair between blocks, like a stadium's sections, and a low wall runs
// along the front. Everything is colored with vertex colors, so it renders
// without a material color: leave the material color black.
//
// The stand runs along X, centered on the origin, and stands on the ground
// at y 0. Its front row is at z 0 and its rows climb toward +Z, so its seats
// face -Z: turn it so that -Z faces the track.
//
// Usage:
//   node bin/generate-grandstand.js                 grandstand.obj
//   node bin/generate-grandstand.js --rows 6 --sections 3 --out small.obj
//
// Parameters:
//   --sections: how many blocks of seats it has, side by side. 4 by default.
//   --seats: how many seats each block has in a row. 8 by default.
//   --rows: how many rows of seats it has. 8 by default.
//   --roof: whether it has a roof, 1 or 0. 1 by default.

const fs = require("fs");
const path = require("path");

const {Mesh, box, parseArgs} = require("./lib/mesh.js");

const defaults = {sections: 4, seats: 8, rows: 8, roof: 1};

// Sizes, in scene units.
const SEAT = 60; // the width of a seat, and the room it has in its row
const STAIR = 90; // the width of the stair between blocks
const ROW_DEPTH = 100; // how deep each step is
const ROW_RISE = 55; // how much higher each step is than the one in front
const BASE = 60; // how high the front row's step is off the ground
const WALL = 70; // how high the front wall is over the front step
const ROOF_HEIGHT = 260; // how high the roof is over the top row's step

const colors = {
  concrete: [0.78, 0.78, 0.82],
  step: [0.7, 0.71, 0.76],
  wall: [0.2, 0.24, 0.36],
  roof: [0.95, 0.96, 0.98],
  post: [0.3, 0.33, 0.42],
  // The blocks' seats, in the arcade's colors, taking turns from block to
  // block.
  seats: [
    [0.1, 0.75, 0.9],
    [1, 0.5, 0.12],
    [0.95, 0.85, 0.2],
    [0.35, 0.8, 0.4],
  ],
};

// seat adds an empty seat whose front edge is at the middle of front, a
// point on its step: a seat pan, and a back leaning on the step's back.
function seat(mesh, front, color) {
  const [x, y, z] = front;
  box(mesh, [x, y + 22, z + 30], [SEAT - 10, 10, 44], color);
  box(mesh, [x, y + 6, z + 30], [10, 12, 20], colors.post);
  box(mesh, [x, y + 42, z + 54], [SEAT - 10, 40, 8], color);
}

function buildGrandstand({sections, seats, rows, roof}) {
  const mesh = new Mesh();
  const sectionWidth = seats * SEAT;
  const width = sections * sectionWidth + (sections + 1) * STAIR;
  const depth = rows * ROW_DEPTH;
  const left = -width / 2;

  // The steps, each a block from the ground up, so the stand is solid
  // underneath.
  for (let row = 0; row < rows; row++) {
    const top = BASE + row * ROW_RISE;
    box(mesh, [0, top / 2, row * ROW_DEPTH + ROW_DEPTH / 2], [width, top, ROW_DEPTH], colors.step);
    // A lighter edge along each step's front, so the rows read from afar.
    box(mesh, [0, top + 2, row * ROW_DEPTH + 8], [width, 4, 16], colors.concrete);
  }

  // The seats, in blocks between the stairs. Every seat is empty.
  for (let section = 0; section < sections; section++) {
    const color = colors.seats[section % colors.seats.length];
    const start = left + STAIR + section * (sectionWidth + STAIR);
    for (let row = 0; row < rows; row++) {
      for (let s = 0; s < seats; s++) {
        seat(mesh, [start + (s + 0.5) * SEAT, BASE + row * ROW_RISE, row * ROW_DEPTH + 10], color);
      }
    }
  }

  // The front wall, and the walls at the ends and the back, as high as the
  // top row.
  const topRow = BASE + (rows - 1) * ROW_RISE;
  const backHeight = topRow + 80;
  box(mesh, [0, (BASE + WALL) / 2, -10], [width + 40, BASE + WALL, 20], colors.wall);
  for (const side of [-1, 1]) {
    box(
      mesh,
      [side * (width / 2 + 10), backHeight / 2, depth / 2],
      [20, backHeight, depth + 20],
      colors.wall
    );
  }
  box(mesh, [0, backHeight / 2, depth + 10], [width + 40, backHeight, 20], colors.wall);

  // The roof, over the seats on posts along the back, sloping up toward the
  // track a little.
  if (roof) {
    const roofY = topRow + ROOF_HEIGHT;
    const posts = sections + 1;
    for (let i = 0; i < posts; i++) {
      const x = left + STAIR / 2 + i * (sectionWidth + STAIR);
      box(
        mesh,
        [x, (backHeight + roofY) / 2, depth],
        [30, roofY - backHeight + 20, 30],
        colors.post
      );
    }
    box(mesh, [0, roofY + 10, depth / 2 + 20], [width + 80, 20, depth + 120], colors.roof);
    box(mesh, [0, roofY - 10, -30], [width + 80, 40, 20], colors.seats[0]);
  }

  return mesh;
}

function main() {
  const {out, ...overrides} = parseArgs(process.argv.slice(2));
  const parameters = {...defaults};
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in defaults)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are ${Object.keys(defaults).join(", ")}`
      );
    }
    parameters[name] = Math.max(name === "roof" ? 0 : 1, Math.round(Number(value)));
  }

  const filename = out || "grandstand.obj";
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const mesh = buildGrandstand(parameters);
  fs.writeFileSync(
    output,
    mesh.toObj(
      ["Generated by bin/generate-grandstand.js", `Parameters ${JSON.stringify(parameters)}`],
      "grandstand"
    )
  );

  // eslint-disable-next-line no-console
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
}

main();
