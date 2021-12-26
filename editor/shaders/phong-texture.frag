#version 300 es

// This is mostly duplicated from phong-lighting because texture support
// causes any program using this shader to throw warnings for texture not
// being bound when used for rendering models that do not have an actual
// texture. And that's because when a shader has a function call for
// `texture` then the program expects there to be a texture bound.
//
// TODO(miguel) look into shader templating to build them on the fly
// depending on the features enabled for a shader. This will allow us to
// scale shader construction - otherwise we are going to potentially have
// to create individual shaders for every rendering feature combination we
// need.

precision highp float;
out vec4 pixelColor;

in vec4 fragmentColor;
in vec4 fragmentNormal;
in vec2 fragmentTextureCoord;

uniform sampler2D uTexture0;uniform bool uTexture0Enabled;
uniform sampler2D uTexture1;uniform bool uTexture1Enabled;
uniform sampler2D uTexture2;uniform bool uTexture2Enabled;
uniform sampler2D uTexture3;uniform bool uTexture3Enabled;
uniform sampler2D uTexture4;uniform bool uTexture4Enabled;
uniform sampler2D uTexture5;uniform bool uTexture5Enabled;

uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;

// TODO(miguel): apply world transform to light position.
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
  vec3 calculatedLightColor = vec3(0.0, 0.0, 0.0);
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

  int textureCount = 0;
  vec4 texelColor = vec4(0.0, 0.0, 0.0, 0.0);

  // TODO(miguel): look into more sophisticated texture blending techniques.
  if (uTexture0Enabled) {
    texelColor += texture(uTexture0, fragmentTextureCoord);
    textureCount += 1;
  }
  if (uTexture1Enabled) {
    texelColor += texture(uTexture1, fragmentTextureCoord);
    textureCount += 1;
  }
  if (uTexture2Enabled) {
    texelColor += texture(uTexture2, fragmentTextureCoord);
    textureCount += 1;
  }
  if (uTexture3Enabled) {
    texelColor += texture(uTexture3, fragmentTextureCoord);
    textureCount += 1;
  }
  if (uTexture4Enabled) {
    texelColor += texture(uTexture4, fragmentTextureCoord);
    textureCount += 1;
  }
  if (uTexture5Enabled) {
    texelColor += texture(uTexture5, fragmentTextureCoord);
    textureCount += 1;
  }

  if (textureCount != 0) {
    pixelColor = texelColor;
  } else {
    pixelColor = fragmentColor + materialColor;
  }

  pixelColor.rgb *= (calculatedLightColor + ambientColor);
}
