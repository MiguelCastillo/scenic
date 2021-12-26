#version 300 es

in vec4 position;
in vec4 normal;
in vec4 color;
in vec2 textureCoord;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

out vec4 fragmentColor;
out vec4 fragmentNormal;
out vec2 fragmentTextureCoord;

void main() {
  mat4 transform = projectionMatrix * worldMatrix;
  gl_Position = transform * position;

  fragmentNormal = worldMatrix * vec4(normal.xyz, 0.0);
  fragmentTextureCoord = textureCoord;
  fragmentColor = color;
}
