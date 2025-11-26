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

  // We don't use this uniform value in the fragment shader. We use the
  // lightPosition vectors because those are configured in the vertex
  // shader to take tangent space into account when bump lighting is
  // enabled.
  vec3 position;
};

out vec4 pixelColor;

in vec4 fragmentPosition;
in vec4 fragmentColor;
in vec4 fragmentNormal;
in vec2 fragmentTextureCoord;

in vec3 lightPosition0;
in vec3 lightPosition1;
in vec3 lightPosition2;
in vec3 lightPosition3;
in vec3 lightPosition4;
in vec3 lightPosition5;

uniform Texture normalmap;
uniform bool bumpLighting;
uniform vec3 ambientColor;
uniform vec4 materialColor;
uniform float materialReflectiveness;
uniform Texture textures[MAX_TEXTURES];
uniform Light lights[MAX_LIGHTS];

void main() {
  vec3 normal;

  if (bumpLighting && normalmap.enabled) {
    normal = texture(normalmap.id, fragmentTextureCoord).rgb;

    // Image's RGBA colors are [0, 1] ranges, but normal vector values
    // are [-1, 1]. So we need to convert color range to normal vector
    // range.
    normal = (normal * 2.0) - 1.0;
  } else {
    normal = normalize(fragmentNormal.xyz);
  }

  // We copy to the tangent lights array for eaier access while iterating thru
  // the lights.
  vec3 lightPositions[MAX_LIGHTS];
  lightPositions[0] = lightPosition0;
  lightPositions[1] = lightPosition1;
  lightPositions[2] = lightPosition2;
  lightPositions[3] = lightPosition3;
  lightPositions[4] = lightPosition4;
  lightPositions[5] = lightPosition5;

  // Calculate lighting.
  vec3 calculatedLightColor;
  if (materialReflectiveness != 0.0) {
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (lights[i].enabled) {
        calculatedLightColor += lights[i].intensity * lights[i].color * clamp(dot(normal, lightPositions[i]), 0.0, 1.0);
      }
    }

    calculatedLightColor *= materialReflectiveness;
  }

  vec4 texelColor;
  int textureCount = 0;
  for (int i = 0; i < MAX_TEXTURES; i++) {
    if (textures[i].enabled) {
      // TODO(miguel): look into more sophisticated texture blending techniques.
      texelColor += texture(textures[i].id, fragmentTextureCoord);
      textureCount++;
    }
  }

  if (textureCount != 0) {
    pixelColor = texelColor;
  } else {
    pixelColor = fragmentColor + materialColor;
  }

  pixelColor.rgb *= ambientColor + calculatedLightColor;
}
