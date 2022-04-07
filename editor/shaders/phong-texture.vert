#version 300 es

#define MAX_LIGHTS 6

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

  // This is really the only thing we are interested about in the
  // vertex shader because we transform the light position when
  // doing bump lighting.
  // The other properties of light are used directly by the fragment
  // shader.
  vec3 position;
};

in vec3 position;
in vec3 normal;
in vec3 color;
in vec2 textureCoord;
in vec3 tangent;
in vec3 bitangent;

uniform bool bumpLighting;
uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;
uniform Light lights[MAX_LIGHTS];
uniform Texture normalmap;

out vec4 fragmentPosition;
out vec4 fragmentColor;
out vec4 fragmentNormal;
out vec2 fragmentTextureCoord;

// Light positions information. These are multiplied by the TBN matrix
// to change their space from world to tangent space for bump lighting.
out vec3 lightPosition0;
out vec3 lightPosition1;
out vec3 lightPosition2;
out vec3 lightPosition3;
out vec3 lightPosition4;
out vec3 lightPosition5;

void main() {
  fragmentPosition = projectionMatrix * worldMatrix * vec4(position, 1.0);
  fragmentNormal = worldMatrix * vec4(normal, 0.0);
  fragmentTextureCoord = textureCoord;
  fragmentColor = vec4(color, 1.0);

  lightPosition0 = lights[0].position;
  lightPosition1 = lights[1].position;
  lightPosition2 = lights[2].position;
  lightPosition3 = lights[3].position;
  lightPosition4 = lights[4].position;
  lightPosition5 = lights[5].position;

  if (bumpLighting && normalmap.enabled) {
    mat3 TBN = mat3(
      normalize((worldMatrix * vec4(tangent.xyz, 0.0)).xyz),
      normalize((worldMatrix * vec4(bitangent.xyz, 0.0)).xyz),
      normalize((worldMatrix * vec4(normal.xyz, 0.0)).xyz));

    // Convert light position to tangent space so that the fragment shader
    // can calculate lighting in that space.
    TBN = transpose(TBN);

    if (lights[0].enabled) {
      lightPosition0 = TBN * lightPosition0;
    }
    if (lights[1].enabled) {
      lightPosition1 = TBN * lightPosition1;
    }
    if (lights[2].enabled) {
      lightPosition2 = TBN * lightPosition2;
    }
    if (lights[3].enabled) {
      lightPosition3 = TBN * lightPosition3;
    }
    if (lights[4].enabled) {
      lightPosition4 = TBN * lightPosition4;
    }
    if (lights[5].enabled) {
      lightPosition5 = TBN * lightPosition5;
    }
  }

  // This is what the shading pipeline wants.
  gl_Position = fragmentPosition;
}
