// Quaternions rotate by default in a ZYX order, which is aligns with
// how matrix4 rotation generates matrices as well. This is why it is
// easy to interchange quaternion rotation with matrix rotation.
//
// But this can be confusing because converting euler angles to quaternions
// back to euler will yield a different result for an euler angle [90, 0, 90].
// The unit test `toEulerAngle 90 on XY` shows the discrepancy. And this is
// not great when we want to extract to rotation euler angles from a
// quaternion, but luckily this is not something you usually do in practice.
//
// This reference has information that is _very_ relevant and useful for the
// implementation here.
// https://danceswithcode.net/engineeringnotes/quaternions/quaternions.html
//
// These are really useful references that provide more context for quaternions
// https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
// https://ntrs.nasa.gov/citations/19770024290
// https://www.weizmann.ac.il/sci-tea/benari/sites/sci-tea.benari/files/uploads/softwareAndLearningMaterials/quaternion-tutorial-2-0-1.pdf
// https://www.andre-gaschler.com/rotationconverter/

import {radToDeg, degToRad} from "./angles.js";
import {fixed7f} from "./float.js";

export class Quaternion {
  constructor(data) {
    if (!data) {
      this._data = identity();
    }

    if (data instanceof Quaternion) {
      this._data = data._data.slice();
    } else {
      this._data = data;
    }
  }

  get data() {
    return this._data;
  }

  rotate(q) {
    return new Quaternion(rotation([], q));
  }
}

export function identity() {
  return [1, 0, 0, 0];
}

// dest is a 4 element array for quaternion angles [w, x, y, z]
export function rotation(dest, [w, x, y, z]) {
  const halfAngle = w / 2;
  const sinHalfAngle = Math.sin(degToRad(halfAngle));
  dest[0] = cos(halfAngle);
  dest[1] = x * sinHalfAngle;
  dest[2] = y * sinHalfAngle;
  dest[3] = z * sinHalfAngle;
  return dest;
}

// dest is a 4 element array for quaternion angles [w, x, y, z]
// https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
export function fromEulerAngles(dest, degreeX, degreeY, degreeZ) {
  // Roll = degreeX
  // Pith = degreeY
  // Yaw = degreeZ
  const halfX = degreeX * 0.5,
    halfY = degreeY * 0.5,
    halfZ = degreeZ * 0.5;
  const sx = Math.sin(degToRad(halfX));
  const cx = Math.cos(degToRad(halfX));
  const sy = Math.sin(degToRad(halfY));
  const cy = Math.cos(degToRad(halfY));
  const sz = Math.sin(degToRad(halfZ));
  const cz = Math.cos(degToRad(halfZ));

  dest[0] = cx * cy * cz + sx * sy * sz;
  dest[1] = sx * cy * cz - cx * sy * sz;
  dest[2] = cx * sy * cz + sx * cy * sz;
  dest[3] = cx * cy * sz - sx * sy * cz;
  return dest;
}

// dest is a 3 element array for ZYX rotation euler angles.
export function toEulerAngle(dest, [w, x, y, z]) {
  let asin = 2 * (w * y - x * z);
  asin = asin < -1 ? -1 : asin > 1 ? 1 : asin;
  dest[1] = fixed7f(radToDeg(Math.asin(asin))); // Pitch
  const _90deg = dest[1];

  if (_90deg === 90) {
    dest[0] = 0;
    dest[2] = radToDeg(-2 * Math.atan2(x, w));
  } else if (_90deg === -90) {
    dest[0] = 0;
    dest[2] = radToDeg(2 * Math.atan2(x, w));
  } else {
    dest[0] = radToDeg(Math.atan2(2 * (w * x + y * z), w * w - x * x - y * y + z * z)); // Roll
    dest[2] = radToDeg(Math.atan2(2 * (w * z + x * y), w * w + x * x - y * y - z * z)); // Yaw
  }
  return dest;
}

// dest is a Matrix4 array(16)
export function toRotationMatrix(dest, [w, x, y, z]) {
  // inhomogeneous form.
  // dest[0] = 1 - 2*(y*y + z*z);
  // dest[1] = 2*(x*y - z*w);
  // dest[2] = 2*(x*z + y*w);
  // dest[4] = 2*(x*y + z*w);
  // dest[5] = 1 - 2*(x*x + z*z);
  // dest[6] = 2*(y*z - x*w);
  // dest[8] = 2*(x*z - y*w);
  // dest[9] = 2*(y*z + x*w);
  // dest[10] = 1 - 2*(x*x + y*y);

  // According to wiki on rotation matrices, the form below (homogeneous)
  // is preferred to avoid distortions when the quaternion is not a unit
  // quaternion. Whereas the form above (inhomogeneous) would generate
  // matrices that are no longer orthogonal, which causes distortion.
  // https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
  dest[0] = w * w + x * x - y * y - z * z;
  dest[1] = 2 * (x * y - z * w);
  dest[2] = 2 * (x * z + y * w);

  dest[4] = 2 * (x * y + z * w);
  dest[5] = w * w - x * x + y * y - z * z;
  dest[6] = 2 * (y * z - x * w);

  dest[8] = 2 * (x * z - y * w);
  dest[9] = 2 * (y * z + x * w);
  dest[10] = w * w - x * x - y * y + z * z;
  return dest;
}
