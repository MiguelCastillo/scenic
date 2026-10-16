#version 300 es
precision highp float;

#define MAX_LIGHTS 6

// terrain draws ground as grass with patches of dirt, lit the way
// phong-lighting lights meshes. Grass and dirt are detail textures, grey and
// light on average, tinted by the grass color of each vertex and dirtColor,
// and repeated every grassSize and dirtSize across the ground. Dirt shows
// where the blend texture's alpha says, repeated every blendSize, and along
// the dirt track of a path. Textures are placed by world position, so they
// tile seamlessly however far the ground goes.

struct Light {
  bool enabled;
  float intensity;
  vec3 color;
  vec3 position;
};

out vec4 pixelColor;

in vec3 fragmentColor;
in vec3 fragmentNormal;
in vec3 fragmentWorldPosition;
in float fragmentTrack;

uniform sampler2D grassTexture;
uniform sampler2D dirtTexture;
uniform sampler2D blendTexture;
uniform float grassSize;
uniform float dirtSize;
uniform float blendSize;
uniform vec3 dirtColor;

uniform vec3 ambientColor;
uniform vec3 ambientGroundColor;
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

void main() {
  vec3 normal = normalize(fragmentNormal);
  vec2 ground = fragmentWorldPosition.xz;

  // Detail textures are about 80% grey, so they are brightened to keep the
  // colors as they are on average.
  float grassDetail = texture(grassTexture, ground / grassSize).r * 1.25;
  float dirtDetail = texture(dirtTexture, ground / dirtSize).r * 1.25;
  vec3 grass = fragmentColor * grassDetail;
  vec3 dirt = dirtColor * dirtDetail;

  // Where dirt shows, with a crisp, ragged edge: the detail roughens the
  // edge before it is sharpened.
  float amount = max(texture(blendTexture, ground / blendSize).a, fragmentTrack);
  amount += (grassDetail - 1.0) * 0.6;
  amount = smoothstep(0.42, 0.58, amount);
  vec3 surface = mix(grass, dirt, amount) + materialColor.rgb;

  vec3 viewDirection = normalize(cameraPosition - fragmentWorldPosition);
  vec3 diffuse = vec3(0.0);
  vec3 specular = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    Light light = lights[i];
    if (!light.enabled || light.intensity == 0.0) {
      continue;
    }
    float facing = dot(normal, light.position);
    diffuse += light.color * light.intensity * clamp(facing, 0.0, 1.0);
    if (facing > 0.0) {
      vec3 halfway = normalize(light.position + viewDirection);
      float shine = pow(max(dot(normal, halfway), 0.0), max(materialShininess, 1.0));
      specular += light.color * light.intensity * shine * materialSpecular;
    }
  }

  vec3 ambient = mix(ambientGroundColor, ambientColor, normal.y * 0.5 + 0.5);
  vec3 color = surface * (ambient + diffuse * materialReflectiveness);
  color += specular * materialReflectiveness;

  if (fogEnabled) {
    float fog = smoothstep(fogNear, fogFar, distance(fragmentWorldPosition, cameraPosition));
    color = mix(color, fogColor, fog);
  }
  pixelColor = vec4(color, 1.0);
}
