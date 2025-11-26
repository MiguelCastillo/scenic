#version 300 es

precision highp float;
out vec4 pixelColor;
in vec4 fragmentColor;

uniform vec4 materialColor;

void main() {
  pixelColor = fragmentColor + materialColor;
}
