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

uniform float cloudStyle;
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

uniform bool fogEnabled;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

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

// CLOUD_CELL is how much of the sky each cloud gets, in puff-sized units:
// across and up.
const vec2 CLOUD_CELL = vec2(8.0, 5.0);

// How much neighboring puffs in a cloud overlap, at least and at most, as a
// part of their two radii together: enough that none floats off on its own,
// and not so much that one swallows the other.
const float MIN_OVERLAP = 0.5;
const float MAX_OVERLAP = 0.65;

// How big each puff is next to the one before it, at least and at most, as
// the puffs fan out from the big one in a cloud's middle.
const float MIN_SHRINK = 0.6;
const float MAX_SHRINK = 0.8;

// dome adds a round puff centered on center with the given radius to a
// cloud's surface at uv: its coverage, and its surface's direction weighted
// toward the taller puff where puffs overlap, so they melt into each other
// with soft creases rather than seams.
void dome(vec2 uv, vec2 center, float radius, inout float coverage, inout vec3 normal, inout float weights) {
  vec2 offset = (uv - center) / radius;
  float inside = max(1.0 - dot(offset, offset), 0.0);
  float weight = inside * exp(sqrt(inside) * radius * 6.0);
  coverage = max(coverage, inside);
  normal += weight * vec3(offset, sqrt(inside));
  weights += weight;
}

// puffs is the clouds at uv, as soft, round puffs melted together like
// clay: (coverage, normal.x, normal.y, normal.z). The sky is cut into cells,
// CLOUD_CELL apart, and cloudCover of them hold a cloud, a croissant: a big
// puff in the middle with one or two smaller puffs on each side, 3 to 5 in
// all, each smaller than the one before it and overlapping it by between
// MIN_OVERLAP and MAX_OVERLAP. They rest on the same line, so the cloud's
// bottom is flat but bumpy and its big puff is the tallest. Each
// cloud fits in its cell, so clouds never overlap each other, and only the
// two rows of cells above the horizon have clouds. coverage is how far inside
// a cloud uv is, from 0 at its edge, and the normal is its surface's
// direction there, x across, y up and z toward the viewer. The cells wrap
// around every `around` across, so clouds go all the way around the sky
// without a seam.
vec4 puffs(vec2 uv, float around) {
  vec2 cell = floor(uv / CLOUD_CELL);
  vec2 key = vec2(mod(cell.x, around), cell.y);
  if (cell.y < 0.0 || cell.y > 1.0 || hash(key + 0.5) >= cloudCover) {
    return vec4(0.0);
  }

  float coverage = 0.0;
  vec3 normal = vec3(0.0);
  float weights = 0.0;

  // How many puffs are on each side of the big one, one or two.
  vec2 counts = 1.0 + step(0.5, vec2(hash(key + 5.9), hash(key + 6.7)));

  // The big puff is at most 1.3 across, so even with two puffs on each side,
  // as big and close as they come, the cloud is narrower than its cell.
  float middle = 1.0 + 0.3 * hash(key + 1.3);

  // The puffs on each side are laid out from the middle out: the first pass
  // finds how far each side reaches, to fit the cloud in its cell, and the
  // second places the puffs.
  vec2 reach = vec2(0.0);
  for (int side = 0; side < 2; side++) {
    float x = 0.0;
    float radius = middle;
    for (int i = 0; i < 2; i++) {
      if (float(i) < counts[side]) {
        float seed = float(side) * 7.3 + float(i) * 3.3;
        float next = radius * mix(MIN_SHRINK, MAX_SHRINK, hash(key + seed));
        x += (radius + next) * (1.0 - mix(MIN_OVERLAP, MAX_OVERLAP, hash(key + seed + 1.7)));
        radius = next;
      }
    }
    reach[side] = x + radius;
  }
  vec2 base = cell * CLOUD_CELL + vec2(
    reach[0] + (CLOUD_CELL.x - reach[0] - reach[1]) * hash(key + 2.1),
    0.15 * CLOUD_CELL.y + (0.85 * CLOUD_CELL.y - 2.0 * middle) * hash(key + 4.7));

  dome(uv, base + vec2(0.0, middle), middle, coverage, normal, weights);
  for (int side = 0; side < 2; side++) {
    float x = 0.0;
    float radius = middle;
    for (int i = 0; i < 2; i++) {
      if (float(i) < counts[side]) {
        float seed = float(side) * 7.3 + float(i) * 3.3;
        float next = radius * mix(MIN_SHRINK, MAX_SHRINK, hash(key + seed));
        x += (radius + next) * (1.0 - mix(MIN_OVERLAP, MAX_OVERLAP, hash(key + seed + 1.7)));
        radius = next;
        dome(uv, base + vec2(side == 0 ? -x : x, radius), radius, coverage, normal, weights);
      }
    }
  }
  return vec4(coverage, normal / max(weights, 1e-4));
}

// clusterPuff is puff i of the cluster of puffs with the given key, as
// (center.x, center.y, depth, radius): puff 0 is the big one, resting on
// the cloud's bottom at base, puffs 1 and 2 are its shoulders, one on each
// side, and the rest sit along the bottom on either side, each smaller the
// farther out it is, some lifted a little, all in front of the big one so
// they overlap its lower edge. Every one shows past the big puff and touches
// it or its shoulder, so the cloud spreads wide without any puff floating
// off on its own.
vec4 clusterPuff(vec2 key, int i, float big, vec2 base) {
  if (i == 0) {
    return vec4(base + vec2(0.0, big), 0.0, big);
  }
  vec2 seed = key + float(i) * 3.3;
  float depth = big * (0.2 + 0.5 * hash(seed + 5.3));
  if (i <= 2) {
    float side = i == 1 ? -1.0 : 1.0;
    return vec4(base + vec2(side * 1.1 * big, 0.65 * big), depth, 0.65 * big);
  }
  float far = hash(seed);
  float side = hash(seed + 1.7) < 0.5 ? -1.0 : 1.0;
  float radius = big * mix(0.7, 0.4, far) * (0.9 + 0.1 * hash(seed + 2.9));
  float lift = 0.25 * big * hash(seed + 4.1);
  vec2 center = base + vec2(side * mix(0.4, 2.0, far) * big, radius + lift);
  return vec4(center, depth, radius);
}

// cluster is the clouds at uv as clusters of round puffs, one big one on top
// and 4 to 12 smaller ones gathered along its bottom (see clusterPuff), in
// cells as for puffs: (coverage, shadow, normal.x, normal.y). Rather than
// melting together, each puff is a ball of its own, and uv shows mostly the
// one nearest the viewer there, blended softly with the ones just behind it
// where they meet. shadow is how much the puffs in front of the nearest one
// shade it, just past their edges, so each puff stands out from the ones
// behind it. The normal is the surface's direction, x across and y up. The
// big puff is at most 1.3 across, so a cluster is at most about 6.3 wide and
// 2.6 tall, and fits in its cell.
vec4 cluster(vec2 uv, float around) {
  vec2 cell = floor(uv / CLOUD_CELL);
  vec2 key = vec2(mod(cell.x, around), cell.y);
  if (cell.y < 0.0 || cell.y > 1.0 || hash(key + 0.5) >= cloudCover) {
    return vec4(0.0);
  }

  float big = 1.0 + 0.3 * hash(key + 1.3);
  vec2 base = cell * CLOUD_CELL + vec2(
    CLOUD_CELL.x / 2.0 + (CLOUD_CELL.x - 4.9 * big) * (hash(key + 2.1) - 0.5),
    0.15 * CLOUD_CELL.y + (0.85 * CLOUD_CELL.y - 2.2 * big) * hash(key + 4.7));
  float count = 4.0 + floor(hash(key + 5.9) * 8.99);

  float coverage = 0.0;
  float nearest = -1e3;
  vec4 shown = vec4(0.0);
  vec3 normal = vec3(0.0);
  for (int i = 0; i <= 12; i++) {
    if (float(i) <= count) {
      vec4 puff = clusterPuff(key, i, big, base);
      vec2 offset = (uv - puff.xy) / puff.w;
      float inside = 1.0 - dot(offset, offset);
      if (inside > 0.0) {
        coverage = max(coverage, inside);
        float near = puff.z + puff.w * sqrt(inside);
        normal += exp(near * 12.0 / big) * vec3(offset, sqrt(inside));
        if (near > nearest) {
          nearest = near;
          shown = puff;
        }
      }
    }
  }
  if (coverage <= 0.0) {
    return vec4(0.0);
  }

  float shadow = 0.0;
  for (int i = 0; i <= 12; i++) {
    if (float(i) <= count) {
      vec4 puff = clusterPuff(key, i, big, base);
      float outside = length(uv - puff.xy) / puff.w - 1.0;
      if (puff.z > shown.z && outside > 0.0) {
        shadow = max(shadow, exp(-outside * 4.0));
      }
    }
  }
  return vec4(coverage, shadow, normalize(normal).xy);
}

// cartoon is the clouds at uv as flat, two-tone cartoon clouds: (amount,
// shade), how much of a cloud is at uv, and how much of that is its shade.
// The sky is cut into cells as for puffs, and cloudCover of them hold a
// cloud: a row of bumps along a flat bottom, bigger toward the middle, with
// one to three bigger bumps on top, taller in some clouds than others. Its
// shade is along its bottom, with a bumpy top edge of its own, under each of
// the bottom row's bumps.
vec2 cartoon(vec2 uv, float around) {
  vec2 cell = floor(uv / CLOUD_CELL);
  vec2 key = vec2(mod(cell.x, around), cell.y);
  if (cell.y < 0.0 || cell.y > 1.0 || hash(key + 0.5) >= cloudCover) {
    return vec2(0.0);
  }

  // The cloud is at most 5 wide plus its end bumps, and 2.7 tall, so it
  // fits in its cell.
  float width = 2.5 + 2.5 * hash(key + 1.3);
  float tall = hash(key + 3.9);
  vec2 bottom = cell * CLOUD_CELL + vec2(
    CLOUD_CELL.x / 2.0 + (CLOUD_CELL.x - width - 2.0) * (hash(key + 2.1) - 0.5),
    0.15 * CLOUD_CELL.y + (0.85 * CLOUD_CELL.y - 2.8) * hash(key + 4.7));
  vec2 p = uv - bottom;

  // How far p is outside the cloud and its shade, negative inside.
  float cloud = 1e3;
  float shade = 1e3;
  // The bottom row's bumps are close enough to always overlap.
  float count = min(7.0, floor(width / 0.75) + 2.0);
  for (int i = 0; i < 7; i++) {
    if (float(i) < count) {
      float t = float(i) / (count - 1.0) * 2.0 - 1.0;
      vec2 seed = key + float(i) * 3.3;
      float radius = mix(0.6, 0.9, hash(seed)) * (1.0 - 0.2 * abs(t));
      vec2 center = vec2(t * width / 2.0 + (hash(seed + 1.7) - 0.5) * 0.15, radius * 0.6);
      cloud = min(cloud, length(p - center) - radius);
      shade = min(shade, length(p - center + vec2(0.0, 0.55 * radius)) - 0.95 * radius);
    }
  }
  float tops = 1.0 + floor(hash(key + 6.7) * 2.99);
  for (int i = 0; i < 3; i++) {
    if (float(i) < tops) {
      vec2 seed = key + float(i) * 5.1 + 0.9;
      float radius = mix(0.8, 1.0 + 0.3 * tall, hash(seed));
      vec2 center = vec2((hash(seed + 1.1) - 0.5) * width * 0.6, mix(0.6, 1.4, tall) * (0.8 + 0.2 * hash(seed + 2.3)));
      cloud = min(cloud, length(p - center) - radius);
    }
  }
  cloud = max(cloud, -p.y);
  return vec2(smoothstep(0.03, -0.03, cloud), smoothstep(0.03, -0.03, shade));
}

// banks paints cloud banks over color, the sky in the direction at angles
// (around the horizon, and up from it), like paper cut-outs: four layers of
// cloud, each a flat color with a row of round bumps along its top, rising
// from the horizon, the farthest ones highest. Farther layers take on more of
// the sky's color, and the nearest is cloudColor, and each layer casts a soft
// shadow on what's behind it, just above its bumps. cloudCover is how high
// they rise, and nearer layers drift by faster.
vec3 banks(vec2 angles, vec3 color) {
  vec3 sky = color;
  for (int layer = 0; layer < 4; layer++) {
    float k = float(layer);
    float count = floor((90.0 - 12.0 * k) / cloudScale);
    float spacing = 6.28318 / count;
    float base = cloudCover * (0.26 - 0.05 * k);
    float x = (angles.x + 3.14159) / spacing + time * 0.01 * cloudSpeed * (k + 1.0);

    // The layer's top is the highest of the bumps near x, each a circle on
    // the layer's base.
    float top = base;
    for (int j = -2; j <= 2; j++) {
      float i = floor(x) + float(j);
      vec2 key = vec2(mod(i, count), k * 17.0);
      float radius = spacing * (0.6 + 0.6 * hash(key + 0.5));
      float across = (x - i - 0.5 - (hash(key + 1.3) - 0.5) * 0.5) * spacing;
      top = max(top, base + sqrt(max(radius * radius - across * across, 0.0)));
    }

    float above = angles.y - top;
    color = mix(color, color * vec3(0.75, 0.82, 0.95), 0.6 * exp(-max(above, 0.0) / (0.3 * spacing)));
    vec3 layerColor = mix(sky, cloudColor, mix(0.3, 1.0, k / 3.0));
    color = mix(color, layerColor, smoothstep(0.0015, -0.0015, above));
  }
  return color;
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
  // crisp, like a cartoon's, and their sides away from the sun are shaded,
  // two tones like a cartoon. They thin out toward the horizon, where they
  // would bunch up. cloudStyle picks their shape: 0 for soft, painted clouds,
  // 1 for croissants of round puffs (see puffs) gathered around the horizon,
  // 2 for layered banks of cloud rising from it (see banks), 3 for flat,
  // two-tone cartoon clouds (see cartoon), and 4 for clusters of puffs (see
  // cluster).
  vec2 sunAround = normalize(sunDirection.xz + 1e-4);
  if (up > 0.0 && cloudStyle < 0.5) {
    vec2 uv = dir.xz / (up + 0.08) * (1.5 / cloudScale) + vec2(1.0, 0.3) * time * 0.03 * cloudSpeed;
    float density = puff(uv);
    float edge = 1.0 - cloudCover;
    float cloud = smoothstep(edge, edge + 0.02, density) * smoothstep(0.02, 0.18, up);

    // A cloud is lit where it gets denser toward the sun.
    float towardSun = puff(uv + sunAround * 0.15);
    float lit = smoothstep(-0.015, 0.015, density - towardSun + 0.02);
    color = mix(color, mix(cloudShadeColor, cloudColor, lit), cloud);
  } else if (up > 0.0 && cloudStyle < 1.5) {
    // The puffs are laid out by direction, across by the angle around the
    // horizon and up by the angle above it, so they look round wherever they
    // are, even down at the horizon, and drift slowly around.
    float cloudsAround = floor(15.0 / cloudScale);
    float unit = 6.28318 / (cloudsAround * CLOUD_CELL.x);
    vec2 angles = vec2(atan(dir.x, dir.z), asin(up));
    vec2 uv = angles / unit + vec2(time * 0.05 * cloudSpeed, 0.0);
    vec4 cloud = puffs(uv, cloudsAround);

    // Clouds lower in the sky are farther away, so they fade a little into
    // it, down to about half by the horizon.
    float amount = smoothstep(0.0, 0.08, cloud.x) * mix(0.5, 1.0, smoothstep(0.03, 0.35, angles.y));

    // Lit softly from above and in front, like clay under a studio light:
    // bright on top, lavender underneath, with a gentle glow at the edges.
    vec3 normal = normalize(cloud.yzw + vec3(0.0, 0.0, 0.2));
    float light = clamp(dot(normal, normalize(vec3(-0.3, 0.8, 0.6))), 0.0, 1.0);
    vec3 shade = mix(cloudShadeColor, cloudColor, smoothstep(0.0, 0.9, light));
    color = mix(color, shade, amount);
  } else if (up > 0.0 && cloudStyle < 2.5) {
    color = banks(vec2(atan(dir.x, dir.z), asin(up)), color);
  } else if (up > 0.0 && cloudStyle < 3.5) {
    // Laid out by direction like the puffs, and faded the same way toward
    // the horizon.
    float cloudsAround = floor(15.0 / cloudScale);
    float unit = 6.28318 / (cloudsAround * CLOUD_CELL.x);
    vec2 angles = vec2(atan(dir.x, dir.z), asin(up));
    vec2 cloud = cartoon(angles / unit + vec2(time * 0.05 * cloudSpeed, 0.0), cloudsAround);
    vec3 shade = mix(cloudShadeColor, cloudColor, 0.35);
    float amount = cloud.x * mix(0.5, 1.0, smoothstep(0.03, 0.35, angles.y));
    color = mix(color, mix(cloudColor, shade, cloud.y), amount);
  } else if (up > 0.0) {
    // Laid out by direction like the puffs, and faded the same way toward
    // the horizon. Each puff is lit on its own, bright white on top and blue
    // underneath, and darker where it's shaded by the puffs in front of it.
    float cloudsAround = floor(15.0 / cloudScale);
    float unit = 6.28318 / (cloudsAround * CLOUD_CELL.x);
    vec2 angles = vec2(atan(dir.x, dir.z), asin(up));
    vec4 cloud = cluster(angles / unit + vec2(time * 0.05 * cloudSpeed, 0.0), cloudsAround);
    float amount = smoothstep(0.0, 0.08, cloud.x) * mix(0.5, 1.0, smoothstep(0.03, 0.35, angles.y));
    vec3 normal = vec3(cloud.zw, sqrt(max(1.0 - dot(cloud.zw, cloud.zw), 0.0)));
    float light = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
    vec3 shade = mix(cloudShadeColor, cloudColor, smoothstep(-0.5, 0.4, light));
    shade = mix(shade, cloudShadeColor, 0.35 * cloud.y);
    color = mix(color, shade, amount);
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

  // The ground below the horizon. In fog, it is a flat ground at height 0,
  // fogged by how far away each pixel's point on it is, the same as the
  // world's floor, so a floor fades into it and both reach the horizon
  // together. Without fog, it fades out of the horizon's haze.
  if (fogEnabled && up < 0.0) {
    float groundDistance = cameraPosition.y > 0.0 ? cameraPosition.y / -up : fogFar;
    color = mix(groundColor, fogColor, smoothstep(fogNear, fogFar, groundDistance));
  } else if (up < -0.005) {
    color = mix(horizonColor, groundColor, smoothstep(-0.005, -0.08, up));
  }

  pixelColor = vec4(color, 1.0);
}
