#version 300 es
precision highp float;

#define MAX_LIGHTS 6

struct Light {
  bool enabled;
  float intensity;
  vec3 color;
  vec3 position;
};

out vec4 pixelColor;

in vec4 fragmentColor;
in vec4 fragmentNormal;
in vec3 fragmentWorldPosition;

uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;
uniform float materialSpecular;
uniform float materialShininess;
uniform vec3 cameraPosition;
uniform bool fogEnabled;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform Light lights[MAX_LIGHTS];

vec3 calculateDiffuseLight(vec3 normal, Light light) {
  if (light.intensity == 0.0 || light.color == vec3(0.0)) {
    return vec3(0.0);
  }

  return light.color * light.intensity * clamp(dot(normal, light.position), 0.0, 1.0);
}

// calculateSpecularLight is the Blinn-Phong highlight of a light: brightest
// where the surface normal lines up with the halfway vector between the light
// and the camera. Surfaces facing away from the light get none.
vec3 calculateSpecularLight(vec3 normal, vec3 lightDirection, vec3 viewDirection, Light light) {
  if (light.intensity == 0.0 || dot(normal, lightDirection) <= 0.0) {
    return vec3(0.0);
  }

  vec3 halfway = normalize(lightDirection + viewDirection);
  float shine = pow(max(dot(normal, halfway), 0.0), max(materialShininess, 1.0));
  return light.color * light.intensity * shine * materialSpecular;
}

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
  vec3 normal = normalize(fragmentNormal.xyz);
  vec3 viewDirection = normalize(cameraPosition - fragmentWorldPosition);
  vec3 calculatedLightColor;
  vec3 specularLightColor;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (lights[i].enabled) {
      calculatedLightColor += calculateDiffuseLight(normal, lights[i]);
      specularLightColor += calculateSpecularLight(normal, lights[i].position, viewDirection, lights[i]);
    }
  }

  calculatedLightColor *= materialReflectiveness;
  specularLightColor *= materialReflectiveness;

  pixelColor = fragmentColor + materialColor;
  pixelColor.rgb *= ambientColor + calculatedLightColor.rgb;

  // Highlights are the light's color reflected off the surface, so they are
  // added rather than tinted by the surface color.
  pixelColor.rgb += specularLightColor;
  pixelColor.rgb = applyFog(pixelColor.rgb, fragmentWorldPosition);
}
