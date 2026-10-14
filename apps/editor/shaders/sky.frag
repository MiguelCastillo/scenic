#version 300 es
precision highp float;

// The sky, painted from the direction each pixel looks in (see sky.js). From
// back to front: the gradient and the sun, the clouds, the far mountains, the
// near mountains, and the ground below the horizon.

in vec4 farPoint;

out vec4 pixelColor;

uniform vec3 cameraPosition;
uniform float time;

uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 groundColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;

uniform float cloudCover;
uniform float cloudScale;
uniform float cloudSpeed;
uniform vec3 cloudColor;
uniform vec3 cloudShadeColor;

// The tallest mountains, as the sine of their angle above the horizon, which
// is how high up the sky a direction's Y is.
uniform float mountainHeight;
uniform vec3 farMountainColor;
uniform vec3 nearMountainColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// noise is smooth value noise, from 0 to 1.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

// fbm layers noise at finer and finer scales, for detail at every size.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

// puff is the clouds' shape: fewer, broader layers of noise than fbm, so
// clouds come out as big rounded puffs rather than wisps.
float puff(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = p * 2.1 + vec2(5.3, 11.7);
    amplitude *= 0.45;
  }
  return value;
}

// ridge is a mountain range's height in the direction around, from 0 to 1.
// It samples noise around a circle, so the range wraps all the way around the
// horizon without a seam.
float ridge(vec2 around, float frequency, float seed) {
  return fbm(around * frequency + seed);
}

void main() {
  vec3 dir = normalize(farPoint.xyz / farPoint.w - cameraPosition);
  float up = dir.y;

  // The sky: the horizon color blending into the zenith color going up.
  vec3 color = mix(horizonColor, zenithColor, pow(smoothstep(0.0, 0.7, up), 0.8));

  // The sun: a crisp disc in a soft glow.
  float facing = max(dot(dir, normalize(sunDirection)), 0.0);
  color += sunColor * (pow(facing, 300.0) * 0.6 + pow(facing, 8.0) * 0.15);
  color = mix(color, sunColor, smoothstep(0.9992, 0.9995, facing));

  // Clouds, on a ceiling high above, seen through the sky. Their edges are
  // crisp, like a cartoon's, and their sides away from the sun are shaded.
  // They thin out toward the horizon, where they would bunch up.
  if (up > 0.0) {
    vec2 uv = dir.xz / (up + 0.08) * (1.5 / cloudScale) + vec2(1.0, 0.3) * time * 0.03 * cloudSpeed;
    float density = puff(uv);
    float edge = 1.0 - cloudCover;
    float cloud = smoothstep(edge, edge + 0.02, density) * smoothstep(0.02, 0.18, up);

    // A cloud is lit where it gets denser toward the sun, so its sun side
    // is bright and its far side in shade. Two tones, like a cartoon.
    float towardSun = puff(uv + normalize(sunDirection.xz + 1e-4) * 0.15);
    float lit = smoothstep(-0.015, 0.015, density - towardSun + 0.02);
    color = mix(color, mix(cloudShadeColor, cloudColor, lit), cloud);
  }

  // Mountains around the horizon: a far range, pale with haze, and a lower,
  // darker range in front of it. Both fade into the horizon at their feet.
  if (mountainHeight > 0.0 && length(dir.xz) > 0.001) {
    vec2 around = normalize(dir.xz);

    float farTop = mountainHeight * (0.3 + 0.7 * ridge(around, 3.0, 0.0));
    if (up < farTop) {
      float haze = smoothstep(farTop, -0.01, up) * 0.45;
      color = mix(farMountainColor, horizonColor, haze);
    }

    float nearTop = mountainHeight * 0.6 * (0.15 + 0.85 * ridge(around, 6.0, 40.0));
    if (up < nearTop) {
      float haze = smoothstep(nearTop, -0.01, up) * 0.35;
      color = mix(nearMountainColor, horizonColor, haze);
    }
  }

  // The ground below the horizon, fading out of the horizon's haze.
  if (up < -0.005) {
    color = mix(horizonColor, groundColor, smoothstep(-0.005, -0.08, up));
  }

  pixelColor = vec4(color, 1.0);
}
