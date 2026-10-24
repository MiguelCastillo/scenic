#!/usr/bin/env node
// generate-ling writes Wingborn's ling, a young cartoon ant, as two OBJ
// files: its body, and its wings, apart so that a script can flap them. It
// is a placeholder until the ling is modeled for real (see the art direction
// in games/wingborn/README.md): a big head with huge glossy eyes, softly
// arched brows, a simple smile and elbowed antennae, on a small chest and a
// round abdomen with a pinched waist, standing on four legs, with two arms.
//
// Its colors are vertex colors, with a lighter cartoon highlight on the
// upper side of each part, so it renders without a material color: the lit
// shaders add the material color to the vertex color, so leave it black.
// The wings are pale, meant to be drawn see-through, with a material
// opacity.
//
// The ling stands on its origin, facing +Z, about 150 units tall to the
// tips of its antennae. The wings are built around where they join its
// back, [0, 60, -2] on the ling, so that a node placed there can flap them
// by scaling its Y (see games/wingborn/scripts/flap.js).
//
// Usage:
//   node bin/generate-ling.js                      ling.obj and ling-wings.obj
//   node bin/generate-ling.js --body-color 0.3,0.5,0.9 --out blue-ling
//
// Parameters:
//   --body-color: the head's and chest's color, such as `--body-color
//     0.9,0.55,0.2`. Amber by default. The abdomen is a darker shade of it.
//   --wing-length: how long each wing is. 70 by default.
//   --out: the files' name, without .obj: name.obj and name-wings.obj.
//     ling by default.
//
// Files are written to resources/obj.

const fs = require("fs");
const path = require("path");

const {Mesh, add, sub, scale, dot, cross, normalize, parseArgs} = require("./lib/mesh.js");

const SIDES = 20; // around a part
const RINGS = 14; // from the bottom of a round part to its top
const TUBE_SIDES = 8; // around a leg, an arm or an antenna, which are thin
const TUBE_STEPS = 4; // along each of their segments

// The direction of the cartoon highlight, up and a little toward the front.
const HIGHLIGHT = normalize([0.3, 1, 0.5]);

const AMBER = [1, 0.64, 0.24];
const WHITE = [0.97, 0.97, 0.95];
const PUPIL = [0.06, 0.05, 0.08];
const DARK = [0.35, 0.18, 0.06];
const WING = [0.82, 0.9, 0.95];

// paint is color lightened, with a sharp edge, where normal faces the
// highlight, so each part gets a painted highlight rather than a gradient.
function paint(color, normal) {
  return dot(normal, HIGHLIGHT) > 0.7 ? color.map((v) => v + (1 - v) * 0.25) : color;
}

// ellipsoid adds a ball centered on center, stretched to radii along X, Y
// and Z, with sides around it and rings from its bottom to its top.
function ellipsoid(mesh, center, radii, color, sides = SIDES, ringCount = RINGS) {
  const rings = Array.from({length: ringCount + 1}, (_, i) => {
    const latitude = Math.PI * (i / ringCount - 0.5);
    return Array.from({length: sides}, (_, s) => {
      const longitude = (s / sides) * 2 * Math.PI;
      const direction = [
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude),
      ];
      // A stretched ball's normals stretch the other way.
      const normal = normalize(direction.map((v, axis) => v / radii[axis]));
      const position = add(
        center,
        direction.map((v, axis) => v * radii[axis])
      );
      return mesh.vertex(position, normal, paint(color, normal));
    });
  });

  for (let i = 0; i < ringCount; i++) {
    for (let s = 0; s < sides; s++) {
      const t = (s + 1) % sides;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// tube sweeps a circle along the line through points, such as a leg's hip,
// knee and foot, from radii[0] at its start to radii[1] at its end, with a
// ball on each joint and end so that it is rounded.
function tube(mesh, points, [startRadius, endRadius], color) {
  const total = points.length - 1;
  for (let segment = 0; segment < total; segment++) {
    const [from, to] = [points[segment], points[segment + 1]];
    const radiusAt = (t) => startRadius + (endRadius - startRadius) * ((segment + t) / total);
    const tangent = normalize(sub(to, from));
    const reference = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const side = normalize(cross(tangent, reference));
    const other = cross(tangent, side);

    const rings = Array.from({length: TUBE_STEPS + 1}, (_, i) => {
      const t = i / TUBE_STEPS;
      const point = add(from, scale(sub(to, from), t));
      return Array.from({length: TUBE_SIDES}, (_, s) => {
        const angle = (s / TUBE_SIDES) * 2 * Math.PI;
        const normal = add(scale(side, Math.cos(angle)), scale(other, Math.sin(angle)));
        return mesh.vertex(add(point, scale(normal, radiusAt(t))), normal, paint(color, normal));
      });
    });
    for (let i = 0; i < TUBE_STEPS; i++) {
      for (let s = 0; s < TUBE_SIDES; s++) {
        const t = (s + 1) % TUBE_SIDES;
        mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
      }
    }
  }
  points.forEach((point, i) => {
    const radius = startRadius + (endRadius - startRadius) * (i / total);
    ellipsoid(mesh, point, [radius, radius, radius], color, TUBE_SIDES, TUBE_SIDES / 2);
  });
}

// mirror is point on the ling's left, its +X side, and its right.
const mirror = ([x, y, z]) => [
  [x, y, z],
  [-x, y, z],
];

// buildBody builds the ling's body: everything but its wings.
function buildBody(bodyColor) {
  const mesh = new Mesh();
  const abdomenColor = bodyColor.map((v) => v * 0.75);
  const limbColor = bodyColor.map((v) => v * 0.8);

  // The abdomen, behind and below the chest, joined by a pinched waist.
  ellipsoid(mesh, [0, 42, -40], [27, 25, 33], abdomenColor);
  ellipsoid(mesh, [0, 44, -12], [7, 7, 8], abdomenColor);
  ellipsoid(mesh, [0, 48, 6], [15, 16, 17], bodyColor);

  // The head, as big as the rest of the ling, on a short neck.
  ellipsoid(mesh, [0, 62, 14], [8, 9, 8], bodyColor);
  ellipsoid(mesh, [0, 92, 20], [37, 33, 32], bodyColor);

  // Huge glossy eyes, each with a dark pupil and a white glint.
  for (const eye of mirror([16, 96, 40])) {
    ellipsoid(mesh, eye, [15, 17, 14], WHITE);
  }
  for (const pupil of mirror([15, 95, 46])) {
    ellipsoid(mesh, pupil, [10, 11, 9], PUPIL);
  }
  for (const glint of mirror([11, 100, 54.5])) {
    ellipsoid(mesh, glint, [3, 3, 2], WHITE);
  }

  // A softly arched brow over each eye, higher toward the middle, so the
  // ling looks friendly and curious.
  for (const side of [1, -1]) {
    tube(
      mesh,
      [
        [side * 6, 118, 45],
        [side * 16, 120, 42],
        [side * 28, 113, 31],
      ],
      [3, 2.5],
      DARK
    );
  }

  // A simple smile, a thin curve across the lower face.
  const smile = Array.from({length: 7}, (_, i) => {
    const x = (i / 6 - 0.5) * 22;
    return [x, 71 + (x / 11) ** 2 * 4, 46.5 - (x / 11) ** 2 * 1.5];
  });
  tube(mesh, smile, [1.8, 1.8], DARK);

  // Elbowed antennae: up from the top of the head, then bent forward.
  for (const side of [1, -1]) {
    tube(
      mesh,
      [
        [side * 11, 120, 22],
        [side * 18, 144, 18],
        [side * 30, 151, 42],
      ],
      [3, 2],
      limbColor
    );
  }

  // Four legs, two on each side, from under the chest out to the ground.
  for (const side of [1, -1]) {
    for (const z of [12, -6]) {
      tube(
        mesh,
        [
          [side * 10, 40, z],
          [side * 30, 30, z + (z > 0 ? 8 : -8)],
          [side * 34, 3, z + (z > 0 ? 14 : -14)],
        ],
        [4, 3],
        limbColor
      );
    }
  }

  // Two arms, from the top of the chest, bent forward at the elbows.
  for (const side of [1, -1]) {
    tube(
      mesh,
      [
        [side * 13, 56, 12],
        [side * 25, 48, 22],
        [side * 22, 46, 36],
      ],
      [3.5, 3],
      limbColor
    );
    ellipsoid(mesh, [side * 22, 46, 38], [5, 5, 5], limbColor);
  }

  return mesh;
}

// buildWings builds the ling's two wings: thin, flat ovals reaching back
// and out from the top of its chest, tilted up, each with both faces, since
// it is seen from either side.
function buildWings(length) {
  const mesh = new Mesh();
  const width = length * 0.38;
  for (const side of [1, -1]) {
    const root = [side * 6, 0, 0];
    // The wing's long axis reaches back and out, and its short one is
    // across it, tilted up from the ground.
    const along = normalize([side * 0.55, 0.35, -1]);
    const across = normalize(cross([0, 1, 0], along));
    const up = normalize(cross(along, across));
    const center = add(root, scale(along, length / 2));

    for (const facing of [1, -1]) {
      const normal = scale(up, facing);
      const middle = mesh.vertex(center, normal, WING);
      const rim = Array.from({length: SIDES}, (_, s) => {
        const angle = (s / SIDES) * 2 * Math.PI;
        const point = add(
          center,
          add(
            scale(along, (Math.cos(angle) * length) / 2),
            scale(across, (Math.sin(angle) * width) / 2)
          )
        );
        return mesh.vertex(point, normal, WING);
      });
      for (let s = 0; s < SIDES; s++) {
        mesh.triangle(middle, rim[s], rim[(s + 1) % SIDES]);
      }
    }
  }
  return mesh;
}

function main() {
  const {out = "ling", bodyColor, wingLength = 70, ...rest} = parseArgs(process.argv.slice(2));
  if (Object.keys(rest).length) {
    throw new Error(
      `unknown parameter "--${Object.keys(rest)[0]}"; parameters are bodyColor, wingLength, out`
    );
  }
  const color = bodyColor ? String(bodyColor).split(",").map(Number) : AMBER;
  const directory = path.join(__dirname, "..", "resources", "obj");
  const header = [
    "Generated by bin/generate-ling.js",
    `Parameters ${JSON.stringify({bodyColor: color, wingLength: Number(wingLength)})}`,
  ];

  for (const [file, mesh, group] of [
    [`${out}.obj`, buildBody(color), "ling"],
    [`${out}-wings.obj`, buildWings(Number(wingLength)), "wings"],
  ]) {
    const output = path.join(directory, file);
    fs.writeFileSync(output, mesh.toObj(header, group));
    // eslint-disable-next-line no-console
    console.log(
      `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
    );
  }
}

main();
