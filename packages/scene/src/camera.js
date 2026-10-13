import {mat4, projections} from "@scenic/math";

import {Node} from "./node.js";

// Camera is a point of view into a Viewport: a lens (its projection) and a
// placement (its transform). Its transform places it in the world like any
// other node, and it looks down its local -Z axis. Its lens comes from the
// `projection` block of its state:
// - {"type": "perspective", "fov": 30, "near": 1, "far": 10000} makes things
//   further away look smaller. fov is the vertical field of view in degrees.
// - {"type": "orthographic", "far": 10000} keeps things the same size however
//   far away they are, measured in pixels from the bottom left.
export class Camera extends Node {
  constructor(options) {
    super({...options, type: "camera"});
    this.projectionMatrix = mat4.Matrix4.identity();
  }

  // viewMatrix is the inverse of the camera's world matrix. It moves the world
  // so that the camera sits at the origin looking down -Z, which is where
  // projection matrices expect the viewer to be.
  get viewMatrix() {
    return this.worldMatrix.invert();
  }

  // updateProjection builds the projection matrix from the camera's lens and
  // the size of what it draws into, in pixels.
  updateProjection(projection, width, height) {
    if (projection.type === "perspective") {
      const {fov, near, far} = projection;
      this.projectionMatrix = projections.PerspectiveProjectionMatrix.create(
        fov,
        width,
        height,
        near,
        far
      );
    } else {
      this.projectionMatrix = projections.OrthographicProjectionMatrix.create(
        width,
        height,
        projection.far
      );
    }

    return this;
  }

  // The projection is rebuilt every frame so that it always matches the
  // canvas size and the lens settings in state, which the editor can change.
  preRender(context) {
    super.preRender(context);
    const {projection} = context.sceneManager.getNodeStateByID(this.id);
    const {width, height} = context.gl.canvas;
    this.updateProjection(projection, width, height);
  }
}
