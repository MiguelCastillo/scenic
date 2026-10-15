#version 300 es

precision highp float;
out vec4 pixelColor;
in vec4 fragmentColor;
in vec3 fragmentWorldPosition;

uniform vec4 materialColor;
// How opaque the surface is, 0 to 1, which is its alpha: below 1 it is drawn
// blended over what is behind it (see Mesh).
uniform float materialOpacity;
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
  pixelColor.a = materialOpacity;
}
