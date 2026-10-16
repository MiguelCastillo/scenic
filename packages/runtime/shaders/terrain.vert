#version 300 es
precision highp float;

// Terrain's vertices are in the terrain's space, with the grass color at
// each one, and in textureCoord, how much of the dirt track along a path is
// there, from 0 to 1, and how many steps the tile has along each side (see
// Terrain in src/terrain.js).
in vec3 position;
in vec3 normal;
in vec3 color;
in vec2 textureCoord;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

out vec3 fragmentColor;
out vec3 fragmentNormal;
out vec3 fragmentWorldPosition;
out float fragmentTrack;
out float fragmentSteps;

void main() {
  vec4 worldPosition = worldMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * worldPosition;
  fragmentWorldPosition = worldPosition.xyz;
  fragmentNormal = (worldMatrix * vec4(normal, 0.0)).xyz;
  fragmentColor = color;
  fragmentTrack = textureCoord.x;
  fragmentSteps = textureCoord.y;
}
