import {mat4} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {Renderable, RenderOrder} from "@scenic/scene";

import {shaderRegistry} from "./shader-registry.js";

// Sky paints a cartoon sky behind everything its viewport draws: a gradient
// from the horizon to the zenith, a sun, puffy clouds that drift, two ranges
// of mountains around the horizon, and the ground below the horizon. It is
// painted from the direction the camera looks through each pixel, so it is
// infinitely far away: flying never gets any closer to the mountains, and fog
// does not touch it. Fog that is the horizon color fades the world into the
// sky. The ground below the horizon is the exception: in fog, it is a flat
// ground at height 0, fogged by how far away each pixel's point on it is, the
// same as a floor there, so a floor and the sky's ground fade into the
// horizon together.
//
// The sky is one triangle that covers the screen, drawn at the far plane and
// only where nothing else has been drawn, so it can be anywhere in its
// viewport. Its transform does nothing.
//
// A sky holds the outdoor lights: lights among its children light everything
// outdoors under the sky, as if they were beside it (see findLights in
// @scenic/scene's mesh.js), such as the sun and a soft fill from the rest of
// the sky. The light marked with "sun": true in its light settings is the
// sun, and the sky paints its sun where that light shines from. Lights shine
// from the direction of their position, so moving the sun moves both the sun
// in the sky and the shading.
//
// Its settings come from "sky" in its state, and all are optional (see
// defaults):
// - zenithColor, horizonColor, groundColor: the sky straight up, the sky at
//   the horizon, and the ground below it, as [r, g, b]. In fog, the ground
//   should match the floor's color, so the two meet without a seam.
// - sunColor: the sun and its glow, as [r, g, b].
// - sunElevation, sunAzimuth: where the sun is when none of the sky's lights
//   is marked as the sun (see below), in degrees: how high above the horizon,
//   and how far around from the +Z axis toward +X.
// - cloudStyle: the clouds' shape: 0 for soft, painted clouds, 1 for
//   croissants of round puffs, a big one in the middle and smaller ones to
//   each side, 2 for layered banks of cloud rising from the horizon, like
//   paper cut-outs, 3 for flat, two-tone cartoon clouds, and 4 for clusters
//   of 5 to 13 round puffs, one big one on top and the rest smaller the
//   farther they are from it, each standing out from the ones behind it.
// - cloudCover: how much of the sky is cloud, 0 to 1.
// - cloudScale: how big the clouds are. Bigger is bigger clouds.
// - cloudSpeed: how fast the clouds drift.
// - cloudColor, cloudShadeColor: the lit tops of clouds and their shaded
//   undersides, as [r, g, b].
// - mountainHeight: how tall the tallest mountains are, as an angle above the
//   horizon in degrees. 0 for none.
// - farMountainColor, nearMountainColor: the far, hazier range and the near,
//   darker range, as [r, g, b].
export class Sky extends Renderable {
  static defaults = {
    zenithColor: [0.25, 0.5, 0.95],
    horizonColor: [0.75, 0.88, 1],
    groundColor: [0.45, 0.62, 0.42],
    sunColor: [1, 0.95, 0.8],
    sunElevation: 35,
    sunAzimuth: 30,
    cloudStyle: 0,
    cloudCover: 0.55,
    cloudScale: 1,
    cloudSpeed: 1,
    cloudColor: [1, 1, 1],
    cloudShadeColor: [0.72, 0.78, 0.92],
    mountainHeight: 7,
    farMountainColor: [0.58, 0.68, 0.88],
    nearMountainColor: [0.38, 0.48, 0.66],
  };

  constructor(options) {
    super({...options, type: "sky"});
    this.triangle = null;
    // The sky is behind everything, so it is drawn first.
    this.renderOrder = RenderOrder.BACKGROUND;
  }

  // prepareForView adds the sky to its viewport's renderablesInView: it
  // covers the whole screen, so it is always in view. Its triangle, twice the
  // screen's size in each direction, in clip space, covers the whole screen
  // with one triangle, made the first time it is drawn.
  prepareForView(context) {
    if (!this.triangle) {
      this.triangle = new VertexBuffer({
        positions: new VertexBufferData(context.gl, [-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      });
    }
    if (this.shaderProgram) {
      this.getViewport()?.renderablesInView.push(this);
    }
  }

  render(context) {
    const {gl, ms, sceneManager} = context;
    const state = {...Sky.defaults, ...sceneManager.getNodeStateByID(this.id).sky};

    // The shader turns each pixel back into the direction it looks in, with
    // the inverse of the view-projection. Inverting the uploaded data as it
    // is works whichever way it is laid out, since the inverse of a transpose
    // is the transpose of the inverse.
    const inverseViewProjection = mat4.invert(mat4.identity(), this.getViewProjectionMatrix().data);

    const sunDirection = this.getSunDirection(sceneManager, state);

    const vec3Uniform = (name, value) => ({
      name,
      update: (gl, {index}) => gl.uniform3fv(index, value),
    });
    const floatUniform = (name, value) => ({
      name,
      update: (gl, {index}) => gl.uniform1f(index, value),
    });

    this.shaderProgram.setUniforms([
      {
        name: "inverseViewProjection",
        update: (gl, {index}) => gl.uniformMatrix4fv(index, false, inverseViewProjection),
      },
      floatUniform("time", ms / 1000),
      vec3Uniform("zenithColor", state.zenithColor),
      vec3Uniform("horizonColor", state.horizonColor),
      vec3Uniform("groundColor", state.groundColor),
      vec3Uniform("sunColor", state.sunColor),
      vec3Uniform("sunDirection", sunDirection),
      floatUniform("cloudStyle", state.cloudStyle),
      floatUniform("cloudCover", state.cloudCover),
      floatUniform("cloudScale", state.cloudScale),
      floatUniform("cloudSpeed", state.cloudSpeed),
      vec3Uniform("cloudColor", state.cloudColor),
      vec3Uniform("cloudShadeColor", state.cloudShadeColor),
      floatUniform("mountainHeight", Math.sin((state.mountainHeight * Math.PI) / 180)),
      vec3Uniform("farMountainColor", state.farMountainColor),
      vec3Uniform("nearMountainColor", state.nearMountainColor),
      ...this.getViewUniforms(),
    ]);

    // The triangle is at the far plane, so it is drawn where the depth
    // buffer is still clear, whether the sky renders before or after the
    // rest of the viewport. It does not write depth, so it never hides
    // anything drawn after it.
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    this.shaderProgram.render(this.triangle);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
  }

  // getSunDirection is the direction the sun is in: toward the position of
  // the sky's light marked as the sun, the same way lights shine (see
  // Mesh.configureLighting), or from the sky's elevation and azimuth without
  // one.
  getSunDirection(sceneManager, state) {
    const sun = (this.childrenByTypeName.light || [])
      .map(({id}) => sceneManager.getNodeStateByID(id))
      .find((lightState) => lightState?.light?.sun);
    const position = sun?.transform?.position;
    if (position) {
      return position;
    }

    const [elevation, azimuth] = [state.sunElevation, state.sunAzimuth].map(
      (degrees) => (degrees * Math.PI) / 180
    );
    return [
      Math.cos(elevation) * Math.sin(azimuth),
      Math.sin(elevation),
      Math.cos(elevation) * Math.cos(azimuth),
    ];
  }

  dispose(gl) {
    if (this.triangle) {
      this.triangle.dispose();
      this.triangle = null;
    }

    super.dispose(gl);
  }
}

shaderRegistry.register(Sky, "shaders/sky");
