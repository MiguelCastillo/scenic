#version 300 es

in vec3 position;
in vec3 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentColor = vec4(color, 1.0);
}
