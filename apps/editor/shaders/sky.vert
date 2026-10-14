#version 300 es

// The sky's triangle covers the screen at the far plane. Each corner also
// carries the point on the far plane it covers, in world space, so that the
// fragment shader can work out the direction each pixel looks in. The point
// stays homogeneous, divided by w only in the fragment shader, because the
// homogeneous point is what interpolates correctly across the screen.

in vec3 position;

uniform mat4 inverseViewProjection;

out vec4 farPoint;

void main() {
  gl_Position = vec4(position.xy, 1.0, 1.0);
  farPoint = inverseViewProjection * vec4(position.xy, 1.0, 1.0);
}
