import * as mat4 from "../../../src/math/matrix4.js";

import {
  getTBNVectorsFromTriangles,
} from "../../../src/math/tbn-matrix.js";

import {
  getIndexedComponents,
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
  getNodeName,
  findChildByName,
  // findChildrenByName,
  findPropertyValueByName,
  convertPolygonIndexesToTriangleIndexes,
  reindexPolygonVertex,
} from "../../../src/formats/fbxfile.js";

import {
  Model,
  Gometry,
  Material,
  Texture,
  Armature,
  Bone,
  AnimationStack,
  AnimationLayer,
  AnimationCurveNode,
  AnimationCurve,
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

export function buildSceneNode(gl, model, sceneNodeConfig, sceneManager) {
  const sceneNode = sceneManager.getNodeByName(sceneNodeConfig.name);

  const nodeWrappersByID = {
    "0,0": {
      connections: [],
    },
  };

  const objects = findChildByName(model, "Objects");
  for (const node of objects.children) {
    nodeWrappersByID[node.attributes[0]] = {
      name: generateFbxNodeName(node),
      node,
      connections: [],
    };
  }

  const connections = findChildByName(model, "Connections");
  for (const props of connections.properties) {
    switch(props.name) {
      case "C": {
        const [type, src, dest, pname] = props.value;
        if (nodeWrappersByID[dest] && nodeWrappersByID[src]) {
          nodeWrappersByID[dest].connections.push({
            child: nodeWrappersByID[src],
            parent: nodeWrappersByID[dest],
            type,
            pname,
          });
        }

        break;
      }
    }
  }

  sceneNode.addItems(
    nodeWrappersByID["0,0"].connections
      .map(({child}) => sceneNodeFromFbxRootNode(gl, child, sceneManager))
      .filter(Boolean));

  // TODO(miguel): Enable this when we are ready to support animation of
  // stacks.
  //
  // Build animation stacks tree.
  // findChildrenByName(objects, "AnimationStack")
  //   .map(s => s.attributes[0])
  //   .forEach(stackID => {
  //     const animationStack = new AnimationStack({
  //       name: nodeWrappersByID[stackID].name,
  //     });

  //     sceneNode.add(
  //       animationStack.addItems(
  //         nodeWrappersByID[stackID].connections
  //           .map(({child}) => sceneNodeFromFbxRootNode(gl, child, sceneManager))
  //           .filter(Boolean)));
  //   });
}

const _textureCache = {};

// sceneNodeFromFbxRootNode traverses the fbx tree of nodes breadth first
// potentially creating scene nodes for each relevant of the fbx file.
// The traversal of the fbx tree is breadth first so that we can find all
// information pertaining to the model before we finally create the model
// node. This is relevant for things like textures where we need to know
// if the model needs to use a shader that supports texture or not.
function sceneNodeFromFbxRootNode(gl, fbxRootNodeWrapper, sceneManager) {
  let textureCount = 0;
  return processNodeWrapper(fbxRootNodeWrapper);

  // NOTE(miguel):
  // We do a breadth first traversal of the fbx nodes so that we can process
  // all the leaf nodes first. This allows us to find all the textures so that
  // when we get to process the model itself, we can know how many textures
  // the model has.
  function processNodeWrapper(fbxNodeWrapper, pname) {
    const childSceneNodes = fbxNodeWrapper.connections.map(connection => {
      return processNodeWrapper(connection.child, connection.pname);
    });

    const sceneNode = createSceneNode(fbxNodeWrapper.name, fbxNodeWrapper.node, pname);

    if (!sceneNode) {
      return;
    }

    fbxNodeWrapper.connections.forEach((connection, i) => {
      if (childSceneNodes[i]) {
        // Only support for OO and OP (partially OP) connections.
        // TODO(miguel): add support for other types of connections.
        // https://download.autodesk.com/us/fbx/20112/fbx_sdk_help/index.html
        switch(connection.type) {
          case "OO":
            sceneNode.add(childSceneNodes[i]);
            break;
          case "OP":
            // TODO(miguel): this needs to handle proper mapping of
            // object to property updates.
            sceneNode.add(childSceneNodes[i]);
            break;
        }
      }
    });

    return sceneNode;
  }

  function createSceneNode(name, fbxNode, pname) {
    let sceneNode;

    switch(fbxNode.name) {
      case "Model": {
        const modelType = fbxNode.attributes[2];

        if (modelType === "Mesh") {
          // If the model has any textures, then we use phong-texture. We have a
          // separate shader specifically for handling textures because if the
          // a shader defined a sample2D type and does not call the `texture`
          // method in the shader then we get the warning:
          // "there is no texture bound to the unit 0".
          // So we want to make sure we pick a shader that can handle texture
          // if the model has any, otherwise use an equivalent shader without
          // textures.
          const shaderName = textureCount ? "phong-texture" : "phong-lighting";
          sceneNode = new Model({name}, createShaderProgram(gl, shaderName));
        } else if (modelType === "LimbNode") {
          sceneNode = new Bone({name});
        } else if (modelType === "Null") {
          // Armatures are the root nodes for a bone hierarchy. This is some
          // information about the armature node which seems to cause issues
          // in some engines.
          // https://blenderartists.org/t/fbx-exporter-adds-extra-armature-bone/685994/21
          // https://github.com/A-Ribeiro/CustomBlenderFBXExporter
          //
          // NOTE: Armatures as generated by blender have a type of `Null`.
          sceneNode = new Armature({name});
        }

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
      case "Geometry": {
        sceneNode = new Gometry({name}, buildVertexBufferForGeometry(gl, name, fbxNode));
        break;
      }
      case "Material": {
        sceneNode = new Material({name});

        const properties70 = findChildByName(fbxNode, "Properties70");
        if (properties70) {
          for (const property of properties70.properties) {
            switch (property.value[0]) {
              case "AmbientColor": {
                sceneNode.withAmbientColor(property.value.slice(4));
                break;
              }
              case "DiffuseColor": {
                sceneNode.withMaterialColor(property.value.slice(4));
                break;
              }
            }
          }
        }

        break;
      }
      case "Texture": {
        const filename = findPropertyValueByName(fbxNode, "RelativeFilename").split("/").pop();
        const filepath = "/resources/textures/" + filename;
        let type = pname ? pname.toLowerCase() : "diffusecolor";

        if (!_textureCache[filepath]) {
          const textureID = Object.keys(_textureCache).length;
          _textureCache[filepath] = {
            id: textureID,
            texture: new Texture(textureID, type, {name}).load(gl, filepath),
          };
        }

        textureCount++;
        sceneNode = _textureCache[filepath].texture.clone();
        break;
      }

      case "AnimationStack": {
        sceneNode = new AnimationStack({name});
        break;
      }
      case "AnimationLayer": {
        sceneNode = new AnimationLayer({name});
        break;
      }
      case "AnimationCurveNode": {
        sceneNode = new AnimationCurveNode(pname, {name});
        break;
      }
      case "AnimationCurve": {
        let times = findPropertyValueByName(fbxNode, "KeyTime");
        let values = findPropertyValueByName(fbxNode, "KeyValueFloat");
        times = times.map(t => parseInt(t));
        sceneNode = new AnimationCurve(times, values, pname, {name});
        break;
      }
      default: {
        return null;
      }
    }

    return sceneNode && sceneNode.withMatrix(mat4.Matrix4.identity());
  }
}

// buildVertexBufferForGeometry builds all the different buffers needed for
// rendering a FBX file. This includes UVs, Normals, and Vertices. The
// semantics include expanding out polygons to triangles to uniformly handle
// quads, triangle fans, and other polygon types.
//
// TODO(miguel): Support triangle fans. It's ultimately less efficient to
// render each triangle individually, especially if the models are built using
// triangle fans. However, current implementation in the scene renderer assumes
// everything is a triangle which is good enough for now.
// buildVertexBufferForGeometry builds all the different buffers needed for
// rendering a FBX file. This includes UVs, Normals, and Vertices. The
// semantics include expanding out polygons to triangles to uniformly handle
// quads, triangle fans, and other polygon types.
//
// TODO(miguel): Support triangle fans. It's ultimately less efficient to
// render each triangle individually, especially if the models are built using
// triangle fans. However, current implementation in the scene renderer assumes
// everything is a triangle which is good enough for now.
function buildVertexBufferForGeometry(gl, name, geometry) {
  const polygonVertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
  let vertices = findPropertyValueByName(geometry, "Vertices");

  // [0, 4, 6, -3] => [0, 4, 6, 0, 6, 2]
  const vertexIndexes = convertPolygonIndexesToTriangleIndexes(polygonVertexIndex);

  // Build out the list of vertices from the triangle indexes. This generates
  // a lot of duplicated vertices, but this is expected because normal vectors
  // often can't be shared so indexing the same coordinate will cause the
  // same normal vertor to be used for polygons that face away from each
  // other and this causes all sorts of issues with lighting.
  vertices = getIndexedComponents(vertices, vertexIndexes, 3);

  // When we extract indexed triangles from the polygons, the vertices
  // are stored in a sequential order. Normals and all the other layers
  // also get ordered sequentially. So we have to rebuild the polygon
  // indexes to be sequential so that we can extract data from the
  // different layers in the correct order.
  //
  // TODO(miguel): is there a way to avoid remapping indexes so that
  // we can just provide `vertexIndexes` to draw elements? Look out for
  // cube shapes that have normal verctors that cannot be shared; more
  // generally, any shape that has 90 degree angles where normals just
  // point in unsharable directions.
  const triangleVertexIndexes = reindexPolygonVertex(polygonVertexIndex);

  // We do a quick check on the vertices with the generated indexes
  // to make sure overall things aren't completely broken. This catches
  // things like out of ranges indexes and so on. It does not validate
  // the triangles represented by the indexes yet.
  validateIndexedTriangles(name, vertices, vertexIndexes);

  // Texture coordinates.
  let uv = getLayerData(geometry, "UV");

  // Tangent, BiTangent, and Normal vector calculations for normal maps
  // support. These are vectors that are used in the shaders to correctly
  // transform vertices and light positions to and from tangent space, which
  // is the space where normal vectors in normal map textures are defined.
  let tangents, bitangents, normals;
  if (uv && uv.length) {
    uv = getIndexedComponents(uv, triangleVertexIndexes, 2);

    const [t,b,n] = getTBNVectorsFromTriangles(vertices, uv);
    tangents = t;
    bitangents = b;
    normals = n;
  }

  if (!normals) {
    normals = getLayerData(geometry, "Normals");
    if (normals) {
      normals = getIndexedComponents(normals, triangleVertexIndexes, 3);
    }
  }

  return new VertexBuffer({
    positions: new VertexBufferData(gl, vertices),
    normals: new VertexBufferData(gl, normals),
    tangents: tangents && new VertexBufferData(gl, tangents),
    bitangents: bitangents && new VertexBufferData(gl, bitangents),
    textureCoords: uv && new TextureVertexBufferData(gl, uv),
  });
}

let _idxNameMap = {};
function generateFbxNodeName(fbxNode) {
  const name = getNodeName(fbxNode);
  if (!_idxNameMap[name]) {
    _idxNameMap[name] = 1;
  }
  return name + "_n" + _idxNameMap[name]++;
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
  console.log("===> index min", min, "index max", max);
}

const layerMap = {
  "UV": {
    layer: "LayerElementUV",
    index: "UVIndex",
    data: "UV",
    componentsPerVertex: 2,
  },
  "Normals": {
    layer: "LayerElementNormal",
    index: "NormalsIndex",
    data: "Normals",
    componentsPerVertex: 3,
  },
  "Colors": {
    layer: "LayerElementColor",
    index: "ColorIndex",
    data: "Colors",
    componentsPerVertex: 4,
  }
}

function getLayerData(geometry, layerDataName) {
  const layer = findChildByName(geometry, layerMap[layerDataName].layer);
  if (!layer) {
    return null;
  }

  const componentsPerVertex = layerMap[layerDataName].componentsPerVertex;
  let components = findPropertyValueByName(layer, layerDataName);

  // NOTE(miguel):
  // For UV, I have only observed in blender exported models:
  // "MappingInformationType": "ByPolygonVertex"
  // "ReferenceInformationType": "IndexToDirect"
  //
  // For Normals, I have only observed in blender exported models:
  // "MappingInformationType": "ByPolygonVertex"
  // "ReferenceInformationType": "Direct"
  //
  // Reference and Index mapping information:
  // https://banexdevblog.wordpress.com/2014/06/23/a-quick-tutorial-about-the-fbx-ascii-format/

  const referenceInformationType = findPropertyValueByName(layer, "ReferenceInformationType");
  if (referenceInformationType === "IndexToDirect") {
    const indexes = findPropertyValueByName(layer, layerMap[layerDataName].index);
    components = getIndexedComponents(components, indexes, componentsPerVertex);
  }

  /*
  // We do not need to deal with ByPolygonVertex here because things are
  // reindexed later on.
  const mappingInformationType = findPropertyValueByName(layer, "MappingInformationType");
  if (mappingInformationType === "ByPolygonVertex") {
    const polygonVertexIndex = findPropertyValueByName(geometry, "PolygonVertexIndex");
    components = toPolygonVertexIndex(components, polygonVertexIndex, componentsPerVertex);
  } else if (mappingInformationType === "ByPolygon") {
    // NOTE(miguel): I have yet to see this around! We'll add support when
    // we need to.
    console.error("===> FBX MappingInformationType ByPolygon is not supported.");
  }
  */

  return components;
}
