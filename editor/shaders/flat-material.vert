#version 300 es

in vec4 position;
in vec4 color;

out vec4 fragmentColor;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

void main() {
  mat4 transform = projectionMatrix * worldMatrix;
  gl_Position = transform * position;
  fragmentColor = color;
}
