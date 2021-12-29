import * as mat4 from "../../../src/math/matrix4.js";

import {
  getTriangleComponents,
  getIndexed2DComponents,
  normalizeTriangleVertices,
} from "../../../src/math/geometry.js";

import {
  createShaderProgram,
} from "../../shader-factory.js";

import {
  VertexBuffer,
  VertexBufferData,
  TextureVertexBufferData,
} from "../../../src/renderer/vertexbuffer.js";

import {
  BrinaryFileLoader
} from "../base-loader.js";

import {
  FbxFile,
  findChildByName,
  findPropertyValueByName,
  triangulatePolygonIndexes,
  mapIndexByPolygonVertex,
} from "../../../src/formats/fbxfile.js";

import {
  ModelNode,
  GometryNode,
  MaterialNode,
  TextureNode,
} from "./scene-node.js";

/**
 * File loader for bfx formatted files.
 *
 * TODO(miguel): move to a worker to make sure parsing
 * fbx files don't block the rendering thread. This is
 * not particularly urgent tho, because binary fbx is
 * pretty quick to parse since there is no tokenizer.
 * It's literally just reading from a buffer the right
 * number of bytes and storing them in a data structure
 * suitable for creating a scene node.
 */
export class Loader extends BrinaryFileLoader {
  load(file) {
    return super.load(file).then(content => FbxFile.fromBinary(content));
  }
}

function sceneNodeFromFbxRootNode(gl, fbxRootNode, sceneManager) {
  let textureCount = 0;
  return createSceneNode(fbxRootNode);

  function createSceneNode({fbxNode, fbxChildren}) {
    const name = nodeName(fbxNode.attributes[1]);
    const childrenSceneNodes = fbxChildren.map(createSceneNode).filter(Boolean);
    let node;

    switch(fbxNode.name) {
      case "Geometry": {
        node = new GometryNode({name}, buildVertexBufferForGeometry(gl, name, fbxNode));

        sceneManager.updateNodeStateByName(name, {
          transform: {
            rotation: [0,0,0],
            position: [0,0,0],
            scale: [1,1,1],
          },
        });

        break;
      }
      case "Model": {
        const shaderName = textureCount ? "phong-texture" : "phong-lighting";
        node = new ModelNode({name}, createShaderProgram(gl, shaderName));

        let rotation = [0,0,0];
        let translation = [0,0,0];
        let scale = [1,1,1];

        const properties70 = findChildByName(fbxNode, "Properties70");
        if (properties70) {
          for (const property of properties70.properties) {
            switch (property.value[0]) {
              case "Lcl Rotation": {
                rotation = property.value.slice(4);
                break;
              }
              case "Lcl Scaling": {
                scale = property.value.slice(4);
                break;
              }
              case "Lcl Translation": {
                translation = property.value.slice(4);
                break;
              }
            }
          }
        }

        sceneManager.updateNodeStateByName(name, {
          transform: {
            rotation: rotation,
            position: translation,
            scale: scale,
          },
        });

        break;
      }
      case "Material": {
        node = new MaterialNode({name});

        const properties70 = findChildByName(fbxNode, "Properties70");
        if (properties70) {
          for (const property of properties70.properties) {
            switch (property.value[0]) {
              case "AmbientColor": {
                node.withAmbientColor(property.value.slice(4));
                break;
              }
              case "DiffuseColor": {
                node.withMaterialColor(property.value.slice(4));
                break;
              }
            }
          }
        }

        break;
      }
      case "Texture": {
        const fileName = findPropertyValueByName(fbxNode, "RelativeFilename").split("/").pop();
        node = new TextureNode(gl, fileName, textureCount++, {name, type: "texture"});
        break;
      }
      default: {
        return null;
      }
    }

    return node.withMatrix(mat4.Matrix4.identity()).addItems(childrenSceneNodes);
  }
}

export function buildSceneNode(gl, model, node, sceneManager) {
  const sceneNode = sceneManager.getNodeByName(node.name);

  const objectsByID = {
    "0,0": {
      fbxChildren: [],
    },
  };

  const objects = findChildByName(model, "Objects");
  for (const fbxNode of objects.children) {
    objectsByID[fbxNode.attributes[0]] = {
      fbxNode,
      fbxChildren: [],
    }
  }

  const connections = findChildByName(model, "Connections");
  for (const props of connections.properties) {
    switch(props.name) {
      case "C": {
        const [connectionType, src, dest] = props.value;
        // Only support for OO and OP (partially OP) connections.
        // TODO(miguel): add support for other types of connections.
        // https://download.autodesk.com/us/fbx/20112/fbx_sdk_help/index.html
        if (connectionType === "OO" || connectionType === "OP") {
          if (objectsByID[src] && objectsByID[dest]) {
            objectsByID[dest].fbxChildren.push(objectsByID[src]);
          }
        }
        break;
      }
    }
  }

  sceneNode.addItems(
    objectsByID["0,0"].fbxChildren
      .map(root => sceneNodeFromFbxRootNode(gl, root, sceneManager))
      .filter(Boolean));
}

// buildVertexBufferForGeometry builds all the different buffers needed for
// rendering a FBX file. This includes UVs, Normals, and Vertices. The
// semantics include expanding out polygons to triangles to uniformly handle
// quads, triangle fans, and other polygon types.
// TODO(miguel): Support triangle fans. It's ultimately less efficient to
// render each triangle individually, especially if the models are built using
// triangle fans. However, current implementation in the scene renderer assumes
// everything is a triangle which is good enough for now.
function buildVertexBufferForGeometry(gl, name, geometry) {
  const vertices = findPropertyValueByName(geometry, "Vertices");
  const polygonVertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
  const vertexIndexes = triangulatePolygonIndexes(polygonVertexIndex);

  validateIndexedTriangles(name, vertices, vertexIndexes);
  const triangles = getTriangleComponents(vertices, vertexIndexes);

  // We will try to use the normals in the geometry if available.
  // If not available then we will calculate them based on the
  // triangles in the model.
  let normals;
  const normalLayer = findChildByName(geometry, "LayerElementNormal");
  if (normalLayer) {
    normals = findPropertyValueByName(normalLayer, "Normals");

    // NOTE(miguel): the only combination I have seen for reference types
    // regarding Normals is:
    // "MappingInformationType": "ByPolygonVertex"
    // "ReferenceInformationType": "Direct"

    if (findPropertyValueByName(normalLayer, "ReferenceInformationType") === "IndexToDirect") {
      normals = getTriangleComponents(normals, findPropertyValueByName(normalLayer, "NormalsIndex"));
    }

    normals = getTriangleComponents(normals, mapIndexByPolygonVertex(polygonVertexIndex));
  } else {
    normals = normalizeTriangleVertices(triangles, true);
  }

  let uv;
  const uvLayer = findChildByName(geometry, "LayerElementUV");
  if (uvLayer) {
    uv = findPropertyValueByName(uvLayer, "UV");

    // NOTE(miguel): the only combination I have seen for reference types
    // regarding UV is:
    // "MappingInformationType": "ByPolygonVertex"
    // "ReferenceInformationType": "IndexToDirect"

    if (findPropertyValueByName(uvLayer, "ReferenceInformationType") === "IndexToDirect") {
      // When IndexToDirect.
      // 1. We map UV using UVIndex
      // 2. Then we expand the result of that by mapping ByPolygonVertexIndex
      uv = getIndexed2DComponents(uv, findPropertyValueByName(uvLayer, "UVIndex"));
    }

    // Map UV to polygon indexes.
    uv = getIndexed2DComponents(uv, mapIndexByPolygonVertex(polygonVertexIndex));
  }

  return new VertexBuffer({
    positions: new VertexBufferData(gl, triangles),
    normals: new VertexBufferData(gl, normals),
    textureCoords: uv && new TextureVertexBufferData(gl, uv),
  });
}

let _idxNameMap = {};
function nodeName(fbxNodeName) {
  const n = fbxNodeName;
  if (!_idxNameMap[n]) {
    _idxNameMap[n] = 1;
  }
  return n + "_n" + _idxNameMap[n]++;
}

function validateIndexedTriangles(name, vertices, indexes) {
  // eslint-disable-next-line
  console.log(name,
    "triangle count", indexes.length/3,
    "index count", indexes.length,
    "vertex count", vertices.length);

  let min = 0, max = 0;
  for (let i = 0; i < indexes.length; i += 3) {
    const i1 = indexes[i];
    const i2 = indexes[i+1];
    const i3 = indexes[i+2];
    min = Math.min(min, i1, i2, i3);
    max = Math.max(max, i1, i2, i3);

    if (i1 === undefined || i2 === undefined || i3 === undefined) {
      // eslint-disable-next-line
      console.log(
        "===> invalid vertex index ", i,
        i1, i2, i3);
    }
    if (vertices[i1] === undefined || vertices[i2] === undefined || vertices[i3] === undefined) {
      // eslint-disable-next-line
      console.log(
        "===> vertex index out of bound", i,
        vertices[i1], vertices[i2], vertices[i3],
        i1, i2, i3);
    }
  }

  // eslint-disable-next-line
  console.log("====> index min", min, "index max", max);
}
