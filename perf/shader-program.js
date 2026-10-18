// ShaderProgram drawing a frame the way Mesh.render does (see render in
// Mesh, in @scenic/scene): for each mesh, add its uniforms, then for each
// copy of it, add its world matrix, use the program for the first copy and
// send only the world matrix for the others, draw, and release. It draws
// with a stand-in WebGL context, whose calls do nothing.
//
// Each mesh's uniforms are made once, ahead, so that what is measured is
// ShaderProgram's own garbage, not its callers': Mesh.render makes new
// arrays of uniforms, and closures, every frame, which this doesn't
// measure.
import {ShaderProgram} from "../packages/renderer/src/program.js";

const programCount = 4;
const meshCount = 300;
const copiesPerMesh = 2;

// makeStandInGL makes a WebGL context whose calls do nothing, other than those
// ShaderProgram needs answers from, such as for a uniform's location.
function makeStandInGL() {
  const doNothing = () => {};
  const answers = {
    TRIANGLES: 4,
    FLOAT: 5126,
    UNSIGNED_INT: 5125,
    LINK_STATUS: 35714,
    getUniformLocation: () => ({}),
    getAttribLocation: () => 0,
    getProgramParameter: () => true,
  };
  return new Proxy(answers, {
    get: (target, property) => (property in target ? target[property] : doNothing),
  });
}

// makeMeshes makes meshes like Mesh's, each with its program, its vertex
// buffers, its copies' world matrices, and its uniforms, made once.
function makeMeshes(gl) {
  const shaderPrograms = Array.from({length: programCount}, (_, i) =>
    new ShaderProgram(gl, {name: `program ${i}`}).addAttributes([
      {name: "position"},
      {name: "normal"},
      {name: "color"},
    ])
  );
  const vertexBuffer = () => ({bind: () => {}, data: new Float32Array(30), componentsPerVertex: 3});
  const matrix = () => ({data: new Float32Array(16)});
  const projectionMatrix = matrix();
  const lightPosition = [1, 2, 3];

  return Array.from({length: meshCount}, (_, i) => {
    const color = [i / meshCount, 1, 1];
    const shininess = i / meshCount;
    return {
      shaderProgram: shaderPrograms[i % programCount],
      vertexBuffers: {
        positions: vertexBuffer(),
        normals: vertexBuffer(),
        colors: vertexBuffer(),
        indexes: {bind: () => {}, data: new Uint32Array(30)},
      },
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
      worldMatrixUniformsByCopy: Array.from({length: copiesPerMesh}, () => {
        const worldMatrix = matrix();
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

export const cases = [
  {
    name: `ShaderProgram draws ${meshCount} meshes, ${copiesPerMesh} copies each`,
    per: "frame",
    budgetBytes: 1000,
    setUp() {
      const meshesInFrame = makeMeshes(makeStandInGL());
      return () => {
        for (let m = 0; m < meshesInFrame.length; m++) {
          const {shaderProgram, vertexBuffers, uniforms, worldMatrixUniformsByCopy} =
            meshesInFrame[m];
          shaderProgram.addUniforms(uniforms);
          for (let i = 0; i < worldMatrixUniformsByCopy.length; i++) {
            shaderProgram.addUniforms(worldMatrixUniformsByCopy[i]);
            if (i === 0) {
              shaderProgram.use();
            } else {
              shaderProgram.sendUniforms(worldMatrixNames);
            }
            shaderProgram.draw(vertexBuffers);
          }
          shaderProgram.release();
        }
      };
    },
  },
];
