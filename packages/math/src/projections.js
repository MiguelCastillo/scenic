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
    super(buildOrthographicProjection_YBottom(width, height, depth));
  }

  static create(width, height, depth) {
    return new OrthographicProjectionMatrix(width, height, depth);
  }
}

// Creates a matrix that projects to clip space with perspective. Items that
// are further away appear smaller, and items that are closer appear bigger.
export function buildPerspectiveProjection(fovInDegres, width, height, near, far) {
  const aspect = width / height;
  const f = 1 / Math.tan(degToRad(fovInDegres) / 2);
  const rangeInv = 1 / (near - far);

  // prettier-ignore
  return [
    f/aspect, 0,                         0,  0,
    0,        f,                         0,  0,
    0,        0,   (near + far) * rangeInv, -1,
    0,        0, near * far * rangeInv * 2,  1,
  ];
}

// Creates a matrix that maps to clips space without any perspective. Items
// appear as the same size regarless of how far they are from the viewer.
// This will have (0, 0) at the top left with positive X going right and
// positive Y going down.
// A side effect of this particular orthographic projection is that geometry
// will need to be rendered clockwise (default in webgl is counter clockwise).
// If geometry isn't provided to webgl in clockwise order then geometry won't
// be render when face culling is turned on. It also makes things more
// complicated because geometry that renders correctly with perspective
// projections will need to be switched to be clockwise frontface; perspective
// projections are happy with conter clockwise by default. Wait, there is more!
// Because geometry needs to be switch to clockwise, you will also need to be
// mindful of normal vector generation or lighting will be incorrect.
// Because of all these subtleties and extra work, default is YBottom.
export function buildOrthographicProjection_YTop(width, height, depth) {
  // prettier-ignore
  return [
    2 / width, 0, 0, 0,
    0, -2 / height, 0, 0,
    0, 0, 2 / depth, 0,
   -1, 1, 0, 1,
  ];
}

// Creates a matrix that maps to clips space without any perspective. Items
// appear as the same size regarless of how far they are from the viewer.
// This will have (0, 0) at the bottom left with positive X going right and
// positive Y going up.
export function buildOrthographicProjection_YBottom(width, height, depth) {
  // prettier-ignore
  return [
    2 / width, 0, 0, 0,
    0, 2 / height, 0, 0,
    0, 0, -2 / depth, 0,
   -1, -1, 0, 1,
  ];
}
