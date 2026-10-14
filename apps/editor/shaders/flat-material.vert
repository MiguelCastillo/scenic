#version 300 es

in vec3 position;
in vec3 color;

out vec4 fragmentColor;
out vec3 fragmentWorldPosition;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  vec4 worldPosition = worldMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * worldPosition;
  fragmentWorldPosition = worldPosition.xyz;
  fragmentColor = vec4(color, 1.0);
}
