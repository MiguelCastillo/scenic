#version 300 es

#define MAX_LIGHTS 6
#define MAX_TEXTURES 6

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

struct Texture {
  bool enabled;

  // NOTE(miguel): for some reason unknown to me whenever a struct has a
  // sampler2D as the first item, using the index in a for loop to
  // access the texture does not work correctly; values don't seem to
  // be set correctly in textures. For example, textures[i]enabled does
  // not have the correct uniform value set.
  sampler2D id;
};

struct Light {
  bool enabled;
  float intensity;
  vec3 color;
  vec3 position;
};

out vec4 pixelColor;

in vec4 fragmentColor;
in vec4 fragmentNormal;
in vec2 fragmentTextureCoord;

uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;
uniform Texture textures[MAX_TEXTURES];
uniform Light lights[MAX_LIGHTS];

vec3 calculateDiffuseLight(vec3 normal, Light light) {
  if (light.intensity == 0.0 || light.color.rgb == vec3(0.0)) {
    return vec3(0.0);
  }

  return light.color * light.intensity * clamp(dot(normal, light.position), 0.0, 1.0);
}

void main() {
  vec3 calculatedLightColor;

  if (materialReflectiveness != 0.0) {
    vec3 normal = normalize(fragmentNormal.xyz);

    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (lights[i].enabled) {
        calculatedLightColor += calculateDiffuseLight(normal, lights[i]);
      }
    }
    calculatedLightColor *= materialReflectiveness;

    // This gives a great blend of CYM colors to generate RGB colors.
    // calculatedLightColor += log2((${processDiffuseLighting(lights)}) * materialReflectiveness);
  }

  vec4 texelColor;
  int textureCount = 0;

  for (int i = 0; i < MAX_TEXTURES; i++) {
    if (textures[i].enabled) {
      // TODO(miguel): look into more sophisticated texture blending techniques.
      textureCount++;
      texelColor += texture(textures[i].id, fragmentTextureCoord);
    }
  }

  if (textureCount != 0) {
    pixelColor = texelColor;
  } else {
    pixelColor = fragmentColor + materialColor;
  }

  pixelColor.rgb *= (calculatedLightColor + ambientColor);
}
