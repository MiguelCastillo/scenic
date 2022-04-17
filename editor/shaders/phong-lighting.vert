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
uniform sampler2D boneMatrixTexture;

out vec4 fragmentColor;
out vec4 fragmentNormal;

mat4 getBoneMatrix(int boneIndex) {
  return mat4(
    texelFetch(boneMatrixTexture, ivec2(0, boneIndex), 0),
    texelFetch(boneMatrixTexture, ivec2(1, boneIndex), 0),
    texelFetch(boneMatrixTexture, ivec2(2, boneIndex), 0),
    texelFetch(boneMatrixTexture, ivec2(3, boneIndex), 0));
}

void main() {
  if (enabledSkinAnimation) {
    vec4 weightedPosition;
    for (int i = 0; i < MAX_BONES; i++) {
      if (weight[i] != 0.0) {
        weightedPosition += getBoneMatrix(int(boneid[i])) * weight[i] * vec4(position, 1.0);
      }
    }
    gl_Position = projectionMatrix * weightedPosition;
  } else {
    gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
  }

  fragmentColor = vec4(color, 1.0);
  fragmentNormal = worldMatrix * vec4(normal, 0.0);
}
