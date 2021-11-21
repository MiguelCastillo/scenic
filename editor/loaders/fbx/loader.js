import {
  VertexBuffer,
  VertexBufferData,
  VertexBufferIndexes,
} from "../../../src/renderer/vertexbuffer.js";

import {
  StaticMesh,
} from "../../../src/scene/static-mesh.js";

import {BrinaryFileLoader} from "../base-loader.js";
import {
  FbxFile,
  findChildByName,
  findChildrenByName,
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

export function buildSceneNode(gl, model, node, sceneManager) {
  const sceneNode = sceneManager.getNodeByName(node.name);
  const objects = findChildByName(model, "Objects");
  const geometries = findChildrenByName(objects, "Geometry");

  if (geometries.length === 1) {
    const vertexBuffer = buildVertexBufferForGeometry(gl, geometries[0]);
    sceneManager
      .getNodeByName(node.name)
      .withVertexBuffer(vertexBuffer);
  } else {
    // TODO(miguel): enable support for this.
    throw new Error("fbx with multiple geometries is not supported. Yet!");

    // Often more complex fbx files have groups of geometry nodes.
    // So we iterate and create renderable nodes for all of them.
    for (let i = 0; i < geometries.length; i++) {
      const vertexBuffer = buildVertexBufferForGeometry(gl, geometries[i]);

      const name = node.name + ":g_" + i;
      const newNode = new StaticMesh({name, type: node.type})
        .withVertexBuffer(vertexBuffer)
        .withShaderProgram(sceneNode.shaderProgram)

      sceneNode.add(newNode);
      sceneManager.linkState(node, newNode);
    }
  }
}

function buildVertexBufferForGeometry(gl, geometry) {
  const vertices = findPropertyValueByName(geometry, "Vertices");
  const vertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");

  return VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
    indexes: new VertexBufferIndexes(gl, triangulatePolygonIndexes(vertexIndex)),
  });
}
