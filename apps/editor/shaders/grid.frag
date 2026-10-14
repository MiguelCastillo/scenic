#version 300 es
precision highp float;

// The grid's lines, worked out from where each pixel is on the grid (see
// grid.js).

in vec3 fragmentWorldPosition;
in vec2 gridCoord;

out vec4 pixelColor;

uniform float spacing;
uniform float lineWidth;
uniform vec4 lineColor;
uniform bool filled;
uniform vec3 fillColor;

uniform vec3 cameraPosition;
uniform bool fogEnabled;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

// applyFog fades color toward the fog color as the fragment gets farther from
// the camera, from none at fogNear to all fog at fogFar.
vec3 applyFog(vec3 color, vec3 worldPosition) {
  if (!fogEnabled) {
    return color;
  }

  float fogFactor = smoothstep(fogNear, fogFar, distance(worldPosition, cameraPosition));
  return mix(color, fogColor, fogFactor);
}

// line is how much of this pixel is covered by lines every cellSize grid
// units, width pixels thick, from 0 to 1. Distances are measured in pixels,
// from how fast the grid coordinate changes across the screen, so lines are
// smooth at any distance. Up close lines are width pixels thick, but in the
// distance they thin so that they never cover more than a small part of a
// cell, the way lines drawn on a real floor would look. Lines thinner than a
// pixel are drawn a pixel wide and fainter. Lines fade out where cells get
// only a few pixels across, rather than shimmering.
float line(vec2 coord, float cellSize, float width) {
  vec2 cells = coord / cellSize;
  vec2 perPixel = fwidth(cells);
  float cellPixels = 1.0 / max(perPixel.x, perPixel.y);
  float thinned = min(width, cellPixels * 0.04);

  vec2 pixels = abs(fract(cells - 0.5) - 0.5) / perPixel;
  float drawn = max(thinned, 1.0);
  float covered = 1.0 - clamp(min(pixels.x, pixels.y) - drawn * 0.5 + 0.5, 0.0, 1.0);
  float faint = min(thinned, 1.0);
  float fade = 1.0 - smoothstep(0.15, 0.4, max(perPixel.x, perPixel.y));
  return covered * faint * fade;
}

void main() {
  float coverage = line(gridCoord, spacing, lineWidth);

  vec3 color;
  if (filled) {
    color = mix(fillColor, lineColor.rgb, coverage);
  } else {
    // Without a fill there is nothing to blend a line's soft edge with, so
    // only the middle of each line is drawn.
    if (coverage < 0.5) {
      discard;
    }
    color = lineColor.rgb;
  }

  pixelColor = vec4(applyFog(color, fragmentWorldPosition), 1.0);
}
