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
in vec3 fragmentWorldPosition;
in vec3 viewDirection;

in vec3 lightPosition0;
in vec3 lightPosition1;
in vec3 lightPosition2;
in vec3 lightPosition3;
in vec3 lightPosition4;
in vec3 lightPosition5;

uniform Texture normalmap;
uniform bool bumpLighting;
uniform vec3 ambientColor;
// The ambient light from below, which ambientColor blends into as surfaces
// turn from facing up to facing down, like light from the sky above and
// bounced off the ground below. It is ambientColor for flat ambient light.
uniform vec3 ambientGroundColor;
uniform vec4 materialColor;
// How opaque the surface is, 0 to 1, which is its alpha: below 1 it is drawn
// blended over what is behind it (see Mesh).
uniform float materialOpacity;
uniform float materialReflectiveness;
uniform float materialSpecular;
uniform float materialShininess;
uniform vec3 cameraPosition;
uniform bool fogEnabled;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform Texture textures[MAX_TEXTURES];
uniform Light lights[MAX_LIGHTS];

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
  vec3 specularLightColor;
  if (materialReflectiveness != 0.0) {
    vec3 view = normalize(viewDirection);
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (lights[i].enabled) {
        calculatedLightColor += lights[i].intensity * lights[i].color * clamp(dot(normal, lightPositions[i]), 0.0, 1.0);
        specularLightColor += calculateSpecularLight(normal, normalize(lightPositions[i]), view, lights[i]);
      }
    }

    calculatedLightColor *= materialReflectiveness;
    specularLightColor *= materialReflectiveness;
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

  // Ambient light comes from above and below in the world, so it goes by the
  // surface's world normal, even when a normal map bumps the lighting.
  float up = normalize(fragmentNormal.xyz).y;
  vec3 ambient = mix(ambientGroundColor, ambientColor, up * 0.5 + 0.5);
  pixelColor.rgb *= ambient + calculatedLightColor;

  // Highlights are the light's color reflected off the surface, so they are
  // added rather than tinted by the surface color.
  pixelColor.rgb += specularLightColor;
  pixelColor.rgb = applyFog(pixelColor.rgb, fragmentWorldPosition);
  pixelColor.a = materialOpacity;
}
