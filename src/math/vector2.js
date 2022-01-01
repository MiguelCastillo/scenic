export function subtract(v1, v2) {
  return [v1[0] - v2[0], v1[1] - v2[1]];
}

export function edges(uv1, uv2, uv3) {
  return [subtract(uv2, uv1), subtract(uv3, uv1)];
}
