import {Camera} from "./camera.js";
import {Node} from "./node.js";

// Viewport is a part of the scene seen through a camera. Its items are what it
// draws, and its cameras are the different angles it can draw them from. It
// draws through one camera at a time: the camera named by `activeCamera` in
// its state, or its first camera when that is not set. A viewport always has
// at least one camera: SceneManager rejects a scene with a viewport that has
// none, and removing a viewport's last camera throws.
export class Viewport extends Node {
  constructor(options) {
    super({...options, type: "viewport"});
    this.cameras = [];
    this.activeCamera = null;
    this._warnedActiveCameraName = null;
  }

  // Cameras are still added as regular children so that they are part of the
  // scene graph: their world matrices are updated every frame and they show
  // up in the editor. They are also kept in cameras so that finding them does
  // not mean searching every child.
  add(node) {
    if (node instanceof Camera) {
      this.cameras.push(node);
      if (!this.activeCamera) {
        this.activeCamera = this.cameras[0];
      }
    }

    return super.add(node);
  }

  remove(node) {
    const index = this.cameras.indexOf(node);
    if (index !== -1) {
      if (this.cameras.length === 1) {
        throw new Error(
          `cannot remove camera "${node.name}": it is the last camera of viewport "${this.name}"`
        );
      }

      this.cameras.splice(index, 1);
      if (this.activeCamera === node) {
        this.activeCamera = this.cameras[0];
      }
    }

    return super.remove(node);
  }

  // updateActiveCamera sets activeCamera to the camera named by `activeCamera`
  // in this viewport's state, or to its first camera when the state does not
  // name one. A name that matches no camera also falls back to the first
  // camera, with a warning the first time that name is seen.
  updateActiveCamera(sceneManager) {
    const name = sceneManager.getNodeStateByID(this.id)?.activeCamera;
    const camera = this.cameras.find((camera) => camera.name === name);

    if (name && !camera && this._warnedActiveCameraName !== name) {
      this._warnedActiveCameraName = name;
      // eslint-disable-next-line no-console
      console.warn(
        `viewport "${this.name}" has no camera named "${name}"; using camera "${this.cameras[0].name}"`
      );
    }

    this.activeCamera = camera || this.cameras[0];
    return this;
  }

  preRender(context) {
    super.preRender(context);
    this.updateActiveCamera(context.sceneManager);

    // Rebuilt the first time it is read this frame. SceneManager runs every
    // preRender before any render, so the camera's matrices are current by
    // then.
    this._viewProjectionMatrix = null;
    this._frustumPlanes = null;
    this._viewUniforms = null;
    const fog = context.sceneManager.getNodeStateByID(this.id)?.fog;
    this._fog = fog && fog.enabled !== false ? fog : null;
  }

  // viewProjectionMatrix takes renderables in this viewport from world space
  // to clip space, through the active camera.
  get viewProjectionMatrix() {
    if (!this._viewProjectionMatrix) {
      const {viewMatrix, projectionMatrix} = this.activeCamera;

      // Projection matrices are stored column-major because that is how they
      // are uploaded, while view matrices are row-major like every other
      // Matrix4. The column-major data of projection * view is the row-major
      // data of transpose(view) * transpose(projection), and the projection's
      // data read row-major is already its transpose.
      this._viewProjectionMatrix = viewMatrix.transpose().multiply(projectionMatrix);
    }

    return this._viewProjectionMatrix;
  }

  // frustumPlanes are the six planes that bound what the active camera sees:
  // its left, right, bottom, top, near and far sides, from the
  // view-projection. Each is [a, b, c, d], facing inward with (a, b, c) a unit
  // length, so a point (x, y, z) is a x + b y + c z + d inside the plane, or
  // outside it when that is negative.
  get frustumPlanes() {
    if (!this._frustumPlanes) {
      // The view-projection's data is column-major, so its rows are every
      // fourth number.
      const m = this.viewProjectionMatrix.data;
      const [x, y, z, w] = [0, 1, 2, 3].map((r) => [m[r], m[4 + r], m[8 + r], m[12 + r]]);
      const plus = (a, b) => a.map((v, i) => v + b[i]);
      const minus = (a, b) => a.map((v, i) => v - b[i]);
      this._frustumPlanes = [
        plus(w, x),
        minus(w, x),
        plus(w, y),
        minus(w, y),
        plus(w, z),
        minus(w, z),
      ].map((plane) => {
        const length = Math.hypot(plane[0], plane[1], plane[2]);
        return plane.map((v) => v / length);
      });
    }

    return this._frustumPlanes;
  }

  // canSeeBoundingVolume is whether any of boundingVolume, such as a mesh's
  // (see bounds.js), placed with worldMatrix, can be in view of the active
  // camera: whether it is not wholly outside what the camera sees.
  canSeeBoundingVolume(boundingVolume, worldMatrix) {
    return !boundingVolume.isOutsideView(this.frustumPlanes, worldMatrix);
  }

  // viewUniforms are the shader uniforms that describe how this viewport is
  // seen: where the active camera is, which lighting uses for specular
  // highlights, and the fog that fades what is far from the camera. Fog is
  // the viewport's `fog` state, `{color, near, far}`, and is off when the
  // state has none or its `enabled` is false.
  get viewUniforms() {
    if (!this._viewUniforms) {
      // Matrix4 data is row-major, so the camera's position is the last
      // column of its world matrix.
      const m = this.activeCamera.worldMatrix.data;
      const cameraPosition = [m[3], m[7], m[11]];
      const fog = this._fog;

      this._viewUniforms = [
        {
          name: "cameraPosition",
          update: (gl, {index}) => {
            gl.uniform3fv(index, cameraPosition);
          },
        },
        {
          name: "fogEnabled",
          update: (gl, {index}) => {
            gl.uniform1i(index, !!fog);
          },
        },
      ];

      if (fog) {
        this._viewUniforms.push(
          {
            name: "fogColor",
            update: (gl, {index}) => {
              gl.uniform3fv(index, fog.color || [0, 0, 0]);
            },
          },
          {
            name: "fogNear",
            update: (gl, {index}) => {
              gl.uniform1f(index, fog.near);
            },
          },
          {
            name: "fogFar",
            update: (gl, {index}) => {
              gl.uniform1f(index, fog.far);
            },
          }
        );
      }
    }

    return this._viewUniforms;
  }
}
