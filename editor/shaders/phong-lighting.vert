#version 300 es
precision highp float;

#define MAX_BONES 4

in vec3 position;
in vec3 normal;
in vec3 color;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

out vec4 fragmentColor;
out vec4 fragmentNormal;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
  fragmentNormal = worldMatrix * vec4(normal, 0.0);
}
