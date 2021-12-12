import * as mat4 from "../../../src/math/matrix4.js";

import {
  VertexBuffer,
  VertexBufferData,
  VertexBufferIndexes,
} from "../../../src/renderer/vertexbuffer.js";

import {
  StaticMesh,
} from "../../../src/scene/static-mesh.js";

import {
  Node as SceneNode,
} from "../../../src/scene/node.js";

import {
  BrinaryFileLoader
} from "../base-loader.js";

import {
  FbxFile,
  findChildByName,
  findPropertyValueByName,
  triangulatePolygonIndexes,
} from "../../../src/formats/fbxfile.js";

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

function sceneNodeFromFbxNode(gl, parentSceneNode, fbxNode, sceneManager) {
  let node;
  const name = nodeName(fbxNode.attributes[1] , parentSceneNode);

  switch(fbxNode.name) {
    case "Geometry": {
      node = new StaticMesh({name, type: "static-mesh"});
      const vertexBuffer = buildVertexBufferForGeometry(gl, name, fbxNode);

      sceneManager.updateNodeStateByName(node.name, {
        transform: {
          rotation: [0,0,0],
          position: [0,0,0],
          scale: [1,1,1],
        },
        ambient: {
          color: [0.5, 1, 1],
        },
      });

      // Add geometry data.
      node = node
        .withVertexBuffer(vertexBuffer)
        .withShaderProgram(parentSceneNode.shaderProgram);
      break;
    }
    case "Model": {
      node = new SceneNode({name, type: "group"});
    
      let rotation = [0,0,0];
      let translation = [0,0,0];
      let scale = [1,1,1];

      const properties70 = findChildByName(fbxNode, "Properties70");
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

      sceneManager.updateNodeStateByName(node.name, {
        transform: {
          rotation: rotation,
          position: translation,
          scale: scale,
        },
      });

      break;
    }
    case "Material": {
      node = new SceneNode({name, type: "material"});
      break;
    }
    default: {
      node = new SceneNode({name, type: "unknown"});
      break;
    }
  }

  return node.withMatrix(mat4.Matrix4.identity());
}

export function buildSceneNode(gl, model, node, sceneManager) {
  const sceneNode = sceneManager.getNodeByName(node.name);

  const objectsByID = {
    "0,0": {
      fbx: null,
      sceneNode,
    },
  };

  const objects = findChildByName(model, "Objects");
  for (const obj of objects.children) {
    const newSceneNode = sceneNodeFromFbxNode(gl, sceneNode, obj, sceneManager);

    objectsByID[obj.attributes[0]] = {
      fbx: obj,
      sceneNode: newSceneNode,
    };
  }

  const connections = findChildByName(model, "Connections");
  for (const props of connections.properties) {
    switch(props.name) {
      case "C": {
        // Only support for OO connections.
        // TODO(miguel): add support for other types of connections.
        // https://download.autodesk.com/us/fbx/20112/fbx_sdk_help/index.html
        if (props.value[0] === "OO") {
          const src = props.value[1];
          const dest = props.value[2];
          objectsByID[dest].sceneNode.add(objectsByID[src].sceneNode);
        }
        break;
      }
    }
  }
}

function buildVertexBufferForGeometry(gl, name, geometry) {
  const vertices = findPropertyValueByName(geometry, "Vertices");
  const vertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
  const indexes = triangulatePolygonIndexes(vertexIndex);

  validateTriangles(name, vertices, indexes);

  return VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
    indexes: new VertexBufferIndexes(gl, indexes),
  });
}

let _idx = 0;
function nodeName(fbxNodeName, sceneNode) {
  return fbxNodeName + "::"+ sceneNode.name + "::" + _idx++;
}

function validateTriangles(name, vertices, indexes) {
  // eslint-disable-next-line
  console.log(name,
    "total triangles", indexes.length/3,
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
