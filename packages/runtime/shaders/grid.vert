#version 300 es

// The grid's square, placed in the world by planeMatrix (see grid.js). Each
// corner also carries where it is on the grid, in grid units from the grid's
// origin, for the fragment shader to draw lines from.

in vec3 position;

uniform mat4 projectionMatrix;
uniform mat4 planeMatrix;
uniform float coordScale;
uniform vec2 coordOffset;

out vec3 fragmentWorldPosition;
out vec2 gridCoord;

void main() {
  vec4 worldPosition = planeMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * worldPosition;
  fragmentWorldPosition = worldPosition.xyz;
  gridCoord = position.xz * coordScale + coordOffset;
}
