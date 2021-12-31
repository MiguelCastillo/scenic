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

uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;
uniform Light lights[MAX_LIGHTS];

vec3 calculateDiffuseLight(vec3 normal, Light light) {
  if (light.intensity == 0.0 || light.color == vec3(0.0)) {
    return vec3(0.0);
  }

  return light.color * light.intensity * clamp(dot(normal, light.position), 0.0, 1.0);
}

void main() {
  vec3 normal = normalize(fragmentNormal.xyz);
  vec3 calculatedLightColor;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (lights[i].enabled) {
      calculatedLightColor += calculateDiffuseLight(normal, lights[i]);
    }
  }

  calculatedLightColor *= materialReflectiveness;

  pixelColor = fragmentColor + materialColor;
  pixelColor.rgb *= ambientColor + calculatedLightColor.rgb;
}
