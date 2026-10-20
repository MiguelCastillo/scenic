// ShaderProgram drawing a frame the way Mesh.render does (see render in
// Mesh, in @scenic/scene): for each mesh, use its program, set its
// uniforms, then for each copy of it, set its world matrix and draw. It
// draws with a stand-in WebGL context, whose calls do nothing (see
// stand-in-gl.js). The meshes and their values are made once, ahead, so
// that what is measured is ShaderProgram's own work, not its callers' (see
// mesh.js for theirs).
import {
  ShaderProgram,
  VertexBuffer,
  VertexBufferData,
  VertexBufferIndexes,
} from "../packages/renderer/src/index.js";

import {makeStandInGL} from "./stand-in-gl.js";

const programCount = 4;
const meshCount = 300;
const copiesPerMesh = 2;
// Each mesh draws this many vertex buffers for each copy, such as a tree's
// trunk and its leaves.
const vertexBuffersPerMesh = 2;

// makeMeshes makes meshes like Mesh's, each with its program, its vertex
// buffers, its copies' world matrices, and its uniforms, made once.
function makeMeshes(gl) {
  const shaderPrograms = Array.from(
    {length: programCount},
    () => new ShaderProgram(gl, {activeUniforms: uniformNames})
  );
  const makeVertexBuffer = () =>
    new VertexBuffer({
      positions: new VertexBufferData(gl, new Float32Array(30)),
      normals: new VertexBufferData(gl, new Float32Array(30)),
      colors: new VertexBufferData(gl, new Float32Array(30)),
      indexes: new VertexBufferIndexes(gl, new Uint32Array(30)),
    });
  return Array.from({length: meshCount}, (_, i) => ({
    shaderProgram: shaderPrograms[i % programCount],
    vertexBuffers: Array.from({length: vertexBuffersPerMesh}, makeVertexBuffer),
    color: [i / meshCount, 1, 1],
    // A whole number: until Node optimizes the frame's function, reading a
    // field holding a fraction, such as 0.25, makes an object for it each
    // time, which would be measured as ShaderProgram's garbage (see
    // measure.js).
    shininess: 8 + (i % 32),
    worldMatrices: Array.from({length: copiesPerMesh}, (_, copy) => {
      const data = new Float32Array(16);
      data[0] = copy;
      return data;
    }),
  }));
}

// The uniforms the meshes' programs have.
const uniformNames = [
  "lightPosition",
  "lightIntensity",
  "lightCount",
  "materialColor",
  "shininess",
  "projectionMatrix",
  "worldMatrix",
];
const lightPosition = [1, 2, 3];
const projectionMatrix = new Float32Array(16);

// makeFrame makes the meshes, with gl, and returns a function that draws
// them all, once: a frame.
function makeFrame(gl) {
  const meshesInFrame = makeMeshes(gl);
  return () => {
    for (let m = 0; m < meshesInFrame.length; m++) {
      const {
        shaderProgram: program,
        vertexBuffers,
        color,
        shininess,
        worldMatrices,
      } = meshesInFrame[m];
      program.use();
      program.uniform("lightPosition").set3fv(lightPosition);
      program.uniform("lightIntensity").set1f(1);
      program.uniform("lightCount").set1i(1);
      program.uniform("materialColor").set3fv(color);
      program.uniform("shininess").set1f(shininess);
      program.uniform("projectionMatrix").setMatrix4fv(false, projectionMatrix);
      const worldMatrix = program.uniform("worldMatrix");
      for (let i = 0; i < worldMatrices.length; i++) {
        worldMatrix.setMatrix4fv(true, worldMatrices[i]);
        for (let j = 0; j < vertexBuffers.length; j++) {
          program.draw(vertexBuffers[j]);
        }
      }
    }
  };
}

const drawn = `${meshCount} meshes, ${copiesPerMesh} copies each, ${vertexBuffersPerMesh} vertex buffers each`;

export const cases = [
  {
    name: `ShaderProgram draws ${drawn}`,
    per: "frame",
    budgetBytes: 1000,
    setUp() {
      return makeFrame(makeStandInGL().gl);
    },
  },
  {
    name: `WebGL calls to draw ${drawn}`,
    per: "frame",
    // A frame's calls are exact, so the budget is what is measured: 1200
    // bindVertexArray and 1200 drawElements, one of each for each buffer
    // drawn, 300 useProgram, and 1200 uniforms, each mesh's color and
    // shininess and each copy's world matrix, the only ones that change.
    budgetCalls: 3900,
    countCalls() {
      const {gl, callCount} = makeStandInGL();
      const frame = makeFrame(gl);
      // The first frame sends every uniform; later frames send only what
      // changed, as in a game.
      frame();
      const before = callCount();
      frame();
      return callCount() - before;
    },
  },
];
