#!/usr/bin/env node
// simplify-obj writes a simpler copy of an OBJ file, with far fewer
// triangles, for a scene to show far away, where the detail is too small to
// see (see a static mesh's lods in the README). It works on the OBJ files the
// generators in bin/ write: vertices with colors, normals, and triangles.
//
// It snaps the mesh's points to a grid of cubes, cell across, and merges the
// points in each cube into one, at their average position, with their
// average normal and color. Triangles whose corners merge together are left
// out. So the mesh keeps its shape and colors, only coarser: the bigger the
// cell, the fewer triangles.
//
// Usage:
//   node bin/simplify-obj.js canopy-tree-205.obj --lod 1 --cell 15
//                                          canopy-tree-205-lod1.obj
//
// Parameters:
//   --lod: which level of detail this is, for the file's name. 1 by default.
//   --cell: how big the grid's cubes are, in the mesh's units. 15 by default.
//   --out: where to write it. Next to the file by default, named for its
//     level of detail.

const fs = require("fs");
const path = require("path");

const {Mesh, normalize, parseArgs} = require("./lib/mesh.js");

function main() {
  const args = process.argv.slice(2);
  const file = args.find(
    (arg, i) => !arg.startsWith("--") && !(args[i - 1] || "").startsWith("--")
  );
  const {lod = 1, cell = 15, out} = parseArgs(args.filter((arg) => arg !== file));
  if (!file) {
    throw new Error("name the OBJ file to simplify, such as canopy-tree-205.obj");
  }

  const objFolder = path.join(__dirname, "..", "resources", "obj");
  const source = path.isAbsolute(file) ? file : path.join(objFolder, file);
  const lines = fs.readFileSync(source, "utf8").split("\n");

  const header = [];
  const positions = [];
  const colors = [];
  const normals = [];
  const triangles = [];
  for (const line of lines) {
    const [kind, ...values] = line.trim().split(/\s+/);
    if (kind === "#") {
      header.push(line.slice(2));
    } else if (kind === "v") {
      const numbers = values.map(Number);
      positions.push(numbers.slice(0, 3));
      colors.push(numbers.length >= 6 ? numbers.slice(3, 6) : [1, 1, 1]);
    } else if (kind === "vn") {
      normals.push(values.map(Number));
    } else if (kind === "f") {
      triangles.push(values.map((corner) => Number(corner.split("/")[0]) - 1));
    }
  }

  // Each cube's point: the sum of the points in it, their normals and their
  // colors, and how many there are, to average.
  const size = Number(cell);
  const cubes = new Map();
  const cubeOf = positions.map((position, i) => {
    const key = position.map((v) => Math.floor(v / size)).join(",");
    if (!cubes.has(key)) {
      cubes.set(key, {position: [0, 0, 0], normal: [0, 0, 0], color: [0, 0, 0], count: 0});
    }
    const cube = cubes.get(key);
    for (let k = 0; k < 3; k++) {
      cube.position[k] += position[k];
      cube.normal[k] += (normals[i] || [0, 1, 0])[k];
      cube.color[k] += colors[i][k];
    }
    cube.count++;
    return key;
  });

  const mesh = new Mesh();
  const vertexOf = new Map();
  for (const [key, cube] of cubes) {
    const average = (sum) => sum.map((v) => v / cube.count);
    const normal = Math.hypot(...cube.normal) > 1e-6 ? normalize(cube.normal) : [0, 1, 0];
    vertexOf.set(key, mesh.vertex(average(cube.position), normal, average(cube.color)));
  }

  // A triangle whose corners land in fewer than three cubes has collapsed,
  // and a triangle with the same corners as one already kept is the same
  // triangle.
  const kept = new Set();
  for (const triangle of triangles) {
    const corners = triangle.map((i) => vertexOf.get(cubeOf[i]));
    const key = [...corners].sort((a, b) => a - b).join(",");
    if (new Set(corners).size === 3 && !kept.has(key)) {
      kept.add(key);
      mesh.triangle(...corners);
    }
  }

  const output = out
    ? path.isAbsolute(out)
      ? out
      : path.join(objFolder, out)
    : source.replace(/\.obj$/, `-lod${lod}.obj`);
  fs.writeFileSync(
    output,
    mesh.toObj(
      [...header, `Simplified by bin/simplify-obj.js from ${path.basename(source)}, cell ${size}`],
      "simplified"
    )
  );

  // eslint-disable-next-line no-console
  console.log(
    `wrote ${output}: ${triangles.length} triangles down to ${mesh.triangles.length}, ` +
      `${positions.length} vertices down to ${mesh.vertices.length}`
  );
}

main();
