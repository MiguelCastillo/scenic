// ShaderProgram drawing a frame the way Mesh.render does (see render in
// Mesh, in @scenic/scene): for each mesh, add its uniforms, then for each
// copy of it, add its world matrix, use the program for the first copy and
// send only the world matrix for the others, and draw. It draws
// with a stand-in WebGL context, whose calls do nothing.
//
// Each mesh's uniforms are made once, ahead, so that what is measured is
// ShaderProgram's own garbage, not its callers': Mesh.render makes new
// arrays of uniforms, and closures, every frame, which this doesn't
// measure.
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
    (_, i) => new ShaderProgram(gl, {name: `program ${i}`})
  );
  const makeVertexBuffer = () =>
    new VertexBuffer({
      positions: new VertexBufferData(gl, new Float32Array(30)),
      normals: new VertexBufferData(gl, new Float32Array(30)),
      colors: new VertexBufferData(gl, new Float32Array(30)),
      indexes: new VertexBufferIndexes(gl, new Uint32Array(30)),
    });
  const matrix = () => ({data: new Float32Array(16)});
  const projectionMatrix = matrix();
  const lightPosition = [1, 2, 3];

  return Array.from({length: meshCount}, (_, i) => {
    const color = [i / meshCount, 1, 1];
    const shininess = i / meshCount;
    return {
      shaderProgram: shaderPrograms[i % programCount],
      vertexBuffers: Array.from({length: vertexBuffersPerMesh}, makeVertexBuffer),
      uniforms: [
        {name: "lightPosition", update: (gl, {index}) => gl.uniform3fv(index, lightPosition)},
        {name: "lightIntensity", update: (gl, {index}) => gl.uniform1f(index, 1)},
        {name: "lightCount", update: (gl, {index}) => gl.uniform1i(index, 1)},
        {name: "materialColor", update: (gl, {index}) => gl.uniform3fv(index, color)},
        {name: "shininess", update: (gl, {index}) => gl.uniform1f(index, shininess)},
        {
          name: "projectionMatrix",
          update: (gl, {index}) => gl.uniformMatrix4fv(index, false, projectionMatrix.data),
        },
      ],
      worldMatrixUniformsByCopy: Array.from({length: copiesPerMesh}, (_, copy) => {
        const worldMatrix = matrix();
        worldMatrix.data[0] = copy;
        return [
          {
            name: "worldMatrix",
            update: (gl, {index}) => gl.uniformMatrix4fv(index, true, worldMatrix.data),
          },
        ];
      }),
    };
  });
}

// What a copy after the first sends, made once, as sendUniforms asks for.
// Mesh.render still makes a new one for each copy, which is its callers'
// garbage, not ShaderProgram's.
const worldMatrixNames = ["worldMatrix"];

// makeFrame makes the meshes, with gl, and returns a function that draws
// them all, once: a frame.
function makeFrame(gl) {
  const meshesInFrame = makeMeshes(gl);
  return () => {
    for (let m = 0; m < meshesInFrame.length; m++) {
      const {shaderProgram, vertexBuffers, uniforms, worldMatrixUniformsByCopy} = meshesInFrame[m];
      shaderProgram.addUniforms(uniforms);
      for (let i = 0; i < worldMatrixUniformsByCopy.length; i++) {
        shaderProgram.addUniforms(worldMatrixUniformsByCopy[i]);
        if (i === 0) {
          shaderProgram.use();
        } else {
          shaderProgram.sendUniforms(worldMatrixNames);
        }
        for (let j = 0; j < vertexBuffers.length; j++) {
          shaderProgram.draw(vertexBuffers[j]);
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
