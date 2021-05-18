#version 300 es

precision highp float;
out vec4 pixelColor;

in vec4 fragmentColor;
in vec4 fragmentNormal;

uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;

uniform vec3 lightColor0;uniform vec3 lightPosition0;uniform float lightIntensity0;
uniform vec3 lightColor1;uniform vec3 lightPosition1;uniform float lightIntensity1;
uniform vec3 lightColor2;uniform vec3 lightPosition2;uniform float lightIntensity2;
uniform vec3 lightColor3;uniform vec3 lightPosition3;uniform float lightIntensity3;
uniform vec3 lightColor4;uniform vec3 lightPosition4;uniform float lightIntensity4;
uniform vec3 lightColor5;uniform vec3 lightPosition5;uniform float lightIntensity5;

vec3 calculateDiffuseLight(vec3 normal, vec3 lightPosition, vec3 lightColor, float lightIntensity) {
  if (lightIntensity == 0.0) {
    return vec3(0.0, 0.0, 0.0);
  }

  if (lightColor.r == 0.0 && lightColor.g == 0.0 && lightColor.b == 0.0) {
    return vec3(0.0, 0.0, 0.0);
  }

  return lightColor * lightIntensity * clamp(dot(normal, lightPosition), 0.1, 1.0);
}

void main() {
  vec3 calculatedLightColor = ambientColor;
  vec3 normal = normalize(fragmentNormal.xyz);

  if (materialReflectiveness != 0.0) {
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition0, lightColor0, lightIntensity0);
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition1, lightColor1, lightIntensity1);
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition2, lightColor2, lightIntensity2);
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition3, lightColor3, lightIntensity3);
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition4, lightColor4, lightIntensity4);
    calculatedLightColor += calculateDiffuseLight(normal, lightPosition5, lightColor5, lightIntensity5);
    calculatedLightColor *= materialReflectiveness;

    // This gives a great blend of CYM colors to generate RGB colors.
    // calculatedLightColor += log2((${processDiffuseLighting(lights)}) * materialReflectiveness);
  }

  pixelColor = fragmentColor + materialColor;
  pixelColor.rgb *= calculatedLightColor.rgb;
}
