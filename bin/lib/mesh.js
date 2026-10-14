// Helpers for the mesh generators in bin/: a Mesh that writes OBJ files with
// vertex colors, shapes to build with, and command line parsing.

const SEGMENTS = 48; // around a lathe

// Mesh accumulates vertices, each with a normal and a color, and triangles
// that index them.
class Mesh {
  constructor() {
    this.vertices = [];
    this.triangles = [];
  }

  vertex(position, normal, color) {
    this.vertices.push({position, normal: normalize(normal), color});
    return this.vertices.length - 1;
  }

  // triangle adds a triangle facing outward: counterclockwise when seen from
  // the side its vertex normals point to, which is what back-face culling
  // keeps.
  triangle(a, b, c) {
    const [pa, pb, pc] = [a, b, c].map((i) => this.vertices[i].position);
    const facing = cross(sub(pb, pa), sub(pc, pa));
    const normal = add(
      add(this.vertices[a].normal, this.vertices[b].normal),
      this.vertices[c].normal
    );
    this.triangles.push(dot(facing, normal) >= 0 ? [a, b, c] : [a, c, b]);
  }

  quad(a, b, c, d) {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  // translate moves the vertices added since start by offset.
  translate(start, offset) {
    for (let i = start; i < this.vertices.length; i++) {
      this.vertices[i].position = add(this.vertices[i].position, offset);
    }
  }

  // toObj is the mesh as an OBJ file, with header as comment lines at the
  // top and the mesh in one group named group.
  toObj(header, group) {
    const lines = [...header.map((line) => `# ${line}`), `g ${group}`];
    for (const {position, color} of this.vertices) {
      lines.push(`v ${[...position, ...color].map(fmt).join(" ")}`);
    }
    for (const {normal} of this.vertices) {
      lines.push(`vn ${normal.map(fmt).join(" ")}`);
    }
    for (const triangle of this.triangles) {
      lines.push(`f ${triangle.map((i) => `${i + 1}//${i + 1}`).join(" ")}`);
    }
    return lines.join("\n") + "\n";
  }
}

const fmt = (n) => (Math.abs(n) < 1e-6 ? "0" : n.toFixed(4).replace(/\.?0+$/, ""));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => {
  const length = Math.hypot(...a);
  return length ? scale(a, 1 / length) : a;
};

// hsl converts a hue, saturation, and lightness, each 0 to 1, to RGB.
function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

// lathe spins a profile around the Z axis. profile is a list of
// {r, z, color} points along the axis, and the normals come from the
// profile's slope so the surface shades smoothly.
function lathe(mesh, profile, segments = SEGMENTS) {
  const rings = profile.map((point, i) => {
    const prev = profile[Math.max(i - 1, 0)];
    const next = profile[Math.min(i + 1, profile.length - 1)];

    // The profile's normal is its tangent turned away from the axis, which
    // works for profiles going either way along Z.
    const [dr, dz] = [next.r - prev.r, next.z - prev.z];
    const flip = dz < 0 ? -1 : 1;
    const [nr, nz] = point.normal || [dz * flip, -dr * flip];

    return Array.from({length: segments}, (_, s) => {
      const angle = (s / segments) * 2 * Math.PI;
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      return mesh.vertex(
        [point.r * cos, point.r * sin, point.z],
        [nr * cos, nr * sin, nz],
        point.color
      );
    });
  });

  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < segments; s++) {
      const t = (s + 1) % segments;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// disk closes the end of a lathe at z with a flat cap facing along normalZ.
function disk(mesh, r, z, normalZ, color, segments = SEGMENTS) {
  const center = mesh.vertex([0, 0, z], [0, 0, normalZ], color);
  const ring = Array.from({length: segments}, (_, s) => {
    const angle = (s / segments) * 2 * Math.PI;
    return mesh.vertex([r * Math.cos(angle), r * Math.sin(angle), z], [0, 0, normalZ], color);
  });
  for (let s = 0; s < segments; s++) {
    mesh.triangle(center, ring[s], ring[(s + 1) % segments]);
  }
}

function sphere(mesh, center, radius, color, segments = 10) {
  const profile = Array.from({length: segments + 1}, (_, i) => {
    const angle = Math.PI * (i / segments - 0.5);
    return {
      r: radius * Math.cos(angle),
      z: radius * Math.sin(angle),
      normal: [Math.cos(angle), Math.sin(angle)],
      color,
    };
  });

  const start = mesh.vertices.length;
  lathe(mesh, profile, segments);
  mesh.translate(start, center);
}

// bezier is a point on a quadratic Bézier curve of [radius, z] points.
const bezier = (p0, p1, p2, t) =>
  add(add(scale(p0, (1 - t) ** 2), scale(p1, 2 * (1 - t) * t)), scale(p2, t * t));

// parseArgs reads `--name value` pairs and `--flag`s. Names can be written
// kebab-case, such as --fin-span, for the camelCase parameters.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) {
      throw new Error(`unexpected argument "${argv[i]}"`);
    }
    const name = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const hasValue = i + 1 < argv.length && !argv[i + 1].startsWith("--");
    args[name] = hasValue ? argv[++i] : true;
  }
  return args;
}

module.exports = {
  Mesh,
  SEGMENTS,
  add,
  sub,
  scale,
  dot,
  cross,
  normalize,
  hsl,
  lathe,
  disk,
  sphere,
  bezier,
  parseArgs,
};
