// http://www.songho.ca/opengl/gl_matrix.html
// https://webgl2fundamentals.org/webgl/lessons/webgl-3d-perspective.html

import {degToRad} from "./angles.js";
import {Matrix4} from "./matrix4.js";

export class PerspectiveProjectionMatrix extends Matrix4 {
  constructor(fovInDegres, width, height, near, far) {
    super(buildPerspectiveProjection(fovInDegres, width, height, near, far));
  }

  static create(fovInDegres, width, height, near, far) {
    return new PerspectiveProjectionMatrix(fovInDegres, width, height, near, far);
  }
}

export class OrthographicProjectionMatrix extends Matrix4 {
  constructor(width, height, depth) {
    super(buildOrthographicProjection(width, height, depth));
  }

  static create(width, height, depth) {
    return new OrthographicProjectionMatrix(width, height, depth);
  }
}

// Creates a matrix that projects to clip space with perspective. Items that
// are further away appear smaller, and items that are closer appear bigger.
export function buildPerspectiveProjection(fovInDegres, width, height, near, far) {
  const aspect = width/height;
  const f = 1/Math.tan(degToRad(fovInDegres)/2);
  const rangeInv = 1/(near - far);

  return [
    f/aspect, 0,                         0,  0,
    0,        f,                         0,  0,
    0,        0,   (near + far) * rangeInv, -1,
    0,        0, near * far * rangeInv * 2,  1,
  ];
}

// Creates a matrix that maps to clips space without any perspective. Items
// appear as the same size regarless of how far they are from the viewer.
export function buildOrthographicProjection(width, height, depth) {
  return [
    2 / width, 0, 0, 0,
    0, -2 / height, 0, 0,
    0, 0, 2 / depth, 0,
   -1, 1, 0, 1,
  ];
}
