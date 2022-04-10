#version 300 es
precision highp float;

#define MAX_BONES 4

in vec3 position;
in vec3 normal;
in vec3 color;
in vec4 weight;
in vec4 boneid;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;
uniform bool enabledSkinAnimation;
uniform mat4 boneMatrices[80];

out vec4 fragmentColor;
out vec4 fragmentNormal;

void main() {
  if (enabledSkinAnimation) {
    vec4 weightedPosition;
    for (int i = 0; i < MAX_BONES; i++) {
      if (weight[i] != 0.0) {
        weightedPosition += boneMatrices[int(boneid[i])] * weight[i] * vec4(position, 1.0);
      }
    }
    gl_Position = projectionMatrix * weightedPosition;
  } else {
    gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  }

  fragmentColor = vec4(color, 1.0);
  fragmentNormal = worldMatrix * vec4(normal, 0.0);
}
