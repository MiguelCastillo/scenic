#version 300 es

precision highp float;
out vec4 pixelColor;
in vec4 fragmentColor;
in vec3 fragmentWorldPosition;

uniform vec4 materialColor;
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

void main() {
  pixelColor = fragmentColor + materialColor;
  pixelColor.rgb = applyFog(pixelColor.rgb, fragmentWorldPosition);
}
