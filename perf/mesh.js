// Meshes drawn by their viewport, the way a scene draws them every frame
// (see render in Viewport, in @scenic/scene): a camera, three lights, and
// meshes with materials, a third of them drawn at several places, like a
// forest's trees, each mesh with a shader program of its own, drawn with a
// stand-in WebGL context (see stand-in-gl.js).
//
// Unlike shader-program.js, it measures the meshes' own code too, such as
// how Mesh.render gives its program its lights and material, every frame.
import {mat4} from "../packages/math/src/index.js";
import {
  VertexBuffer,
  VertexBufferData,
  VertexBufferIndexes,
  ShaderProgram,
} from "../packages/renderer/src/index.js";
import {Camera, Geometry, Light, Mesh, Node, Viewport} from "../packages/scene/src/index.js";

import {makeStandInGL} from "./stand-in-gl.js";

const meshCount = 60;
// Every third mesh is drawn at this many places.
const copiesPerForestMesh = 4;

// The uniforms of the shader meshes draw with, phong-lighting, as WebGL
// lists them for a linked program.
const phongLightingUniforms = [
  "projectionMatrix",
  "worldMatrix",
  "enabledSkinAnimation",
  "boneMatrixTexture",
  "ambientColor",
  "ambientGroundColor",
  "materialColor",
  "materialOpacity",
  "materialReflectiveness",
  "materialSpecular",
  "materialShininess",
  "cameraPosition",
  "fogEnabled",
  "fogColor",
  "fogNear",
  "fogFar",
  ...[0, 1, 2, 3, 4, 5].flatMap((i) =>
    ["enabled", "intensity", "color", "position"].map((field) => `lights[${i}].${field}`)
  ),
];

const at = (x, y, z) => mat4.Matrix4.trs([x, y, z], [0, 0, 0], [1, 1, 1]);

// makeScene makes the viewport, with gl, and returns the context its nodes
// get each frame.
function makeScene(gl) {
  const states = new Map();
  const sceneManager = {getNodeStateByID: (id) => states.get(id)};
  const context = {gl, sceneManager, ms: 0};

  const root = new Node({name: "root"});
  const viewport = new Viewport({name: "world"});
  root.add(viewport);
  states.set(viewport.id, {fog: {color: [0.7, 0.8, 0.9], near: 100, far: 900}});

  const camera = new Camera({name: "camera"}).withWorldMatrix(at(0, 10, 300));
  viewport.add(camera);
  states.set(camera.id, {projection: {type: "perspective", fov: 60, near: 1, far: 1000}});

  for (const [i, position] of [
    [0, 100, 0],
    [50, 80, 20],
    [-40, 60, 10],
  ].entries()) {
    const light = new Light({type: "light", name: `light ${i}`});
    viewport.add(light);
    states.set(light.id, {transform: {position}, light: {color: [1, 1, 1], intensity: 0.8}});
  }

  for (let i = 0; i < meshCount; i++) {
    const mesh = new Mesh({type: "static-mesh", name: `mesh ${i}`}).withWorldMatrix(
      at((i % 10) * 20 - 90, 0, -Math.floor(i / 10) * 20)
    );
    viewport.add(mesh);
    mesh.add(
      new Geometry(
        {name: "shape"},
        new VertexBuffer({
          positions: new VertexBufferData(gl, [-5, -5, -5, 5, 5, 5, 5, -5, 5]),
          normals: new VertexBufferData(gl, [0, 1, 0, 0, 1, 0, 0, 1, 0]),
          indexes: new VertexBufferIndexes(gl, [0, 1, 2]),
        })
      )
    );
    if (i % 3 === 0) {
      mesh.worldMatrices = Array.from({length: copiesPerForestMesh}, (_, copy) =>
        at((i % 10) * 20 - 90 + copy * 4, 0, -Math.floor(i / 10) * 20)
      );
    }
    mesh.withShaderProgram(new ShaderProgram(gl, {activeUniforms: phongLightingUniforms}));
    states.set(mesh.id, {
      material: {color: [i / meshCount, 0.5, 0.5, 1], specular: 0.3, shininess: 16},
      ambient: {color: [0.4, 0.4, 0.45]},
    });
  }

  // What is in view is chosen once: this measures drawing it.
  viewport.preRender(context);
  viewport.prepareForView(context);
  for (const mesh of Node.findChildrenByType(viewport, Mesh)) {
    mesh.prepareForView(context);
  }
  return {viewport, context};
}

// makeFrame makes the scene, with gl, and returns a function that draws a
// frame of it: its viewport's preRender, which a frame starts with, and its
// render.
function makeFrame(gl) {
  const {viewport, context} = makeScene(gl);
  return () => {
    viewport.preRender(context);
    viewport.render(context);
  };
}

const drawn = `${meshCount} meshes, a third at ${copiesPerForestMesh} places`;

export const cases = [
  {
    name: `Viewport draws ${drawn}`,
    per: "frame",
    // About twice the 58.7 KB measured when it was set. What is left is
    // mostly each mesh finding its lights and material in the scene's state
    // (see getLightsState and getMaterialsState in Mesh), and the
    // viewport's lists of what to draw (see render in Viewport).
    budgetBytes: 120_000,
    setUp() {
      return makeFrame(makeStandInGL().gl);
    },
  },
  {
    name: `WebGL calls to draw ${drawn}`,
    per: "frame",
    // Calls are exact, so the budget is what is measured: 120 draws, 40
    // meshes once and 20 at 4 places, each with its bindVertexArray, 60
    // useProgram, one for each mesh, and 80 world matrices, those of the
    // meshes at several places, the only uniforms that change.
    budgetCalls: 380,
    countCalls() {
      const {gl, callCount} = makeStandInGL();
      const frame = makeFrame(gl);
      frame();
      const before = callCount();
      frame();
      return callCount() - before;
    },
  },
];
