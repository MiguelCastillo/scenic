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
  findChildrenByType,
} from "../../../src/scene/node.js";

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
  findChildrenByName,
  findPropertyValueByName,
  convertPolygonIndexesToTriangleIndexes,
  reindexPolygonVertex,
} from "../../../src/formats/fbxfile.js";

import {
  Animation as AnimationSceneNode,
} from "../../../src/scene/animation.js";

import {
  Mesh,
  Gometry,
  SkinDeformer,
  SkinDeformerCluster,
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

let animationID = 0;

export function buildSceneNode(gl, fbxDocument, sceneNodeConfig, sceneManager) {
  const sceneNode = sceneManager.getNodeByName(sceneNodeConfig.name);

  const nodeWrappersByID = {
    "0,0": {
      connections: [],
    },
  };

  const objects = findChildByName(fbxDocument, "Objects");
  for (const node of objects.children) {
    nodeWrappersByID[node.attributes[0]] = {
      name: generateFbxNodeName(node),
      node,
      connections: [],
    };
  }

  const connections = findChildByName(fbxDocument, "Connections");
  for (const props of connections.properties) {
    switch(props.name) {
      case "C": {
        const [type, src, dest, pname] = props.value;
        if (nodeWrappersByID[dest] && nodeWrappersByID[src]) {
          nodeWrappersByID[dest].connections.push({
            src: nodeWrappersByID[src],
            dest: nodeWrappersByID[dest],
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
      .map(connection => sceneNodeFromConnection(gl, connection, sceneManager, sceneNode))
      .filter(Boolean)
      .sort((a, b) => {
        if (a instanceof Armature) {
          return -1;
        } else if (b instanceof Armature) {
          return 1;
        }
        return 0;
      }));

  const animationNode = new AnimationSceneNode({name: `Animation_n${animationID++}`});
  findChildrenByName(objects, "AnimationStack")
    .map(s => s.attributes[0])
    .forEach(stackID => {
      const animationStack = new AnimationStack({
        name: nodeWrappersByID[stackID].name,
      });

      animationNode.add(
        animationStack.addItems(
          nodeWrappersByID[stackID].connections
            .map((connection) => sceneNodeFromConnection(gl, connection, sceneManager, sceneNode))
            .filter(Boolean)));
    });

  if (animationNode.items.length) {
    sceneNode.add(animationNode);
    sceneNode.animation = animationNode;

    // Initialize the state for the animation node
    const {animation={}} = sceneManager.getNodeStateByName(sceneNode.name);
    sceneManager.updateNodeStateByName(animationNode.name, {
      ...animation,
      name: animationNode.name,
      type: animationNode.type,
      stackNames: animationNode.items.map(item => item.name),
    });
  }

  // We want to find all the meshes and initialize shader programs for each.
  initShaderProgramsForMeshes(gl, sceneNode);
  initShaderProgramsForArmatures(gl, sceneNode);
}

const _textureCache = {};

// sceneNodeFromConnection traverses the fbx tree of nodes depth first
// creating scene nodes for each relevant of the fbx file.
function sceneNodeFromConnection(gl, rootConnection, sceneManager, relativeRootSceneNode) {
  const sceneNode = createSceneNode(rootConnection, relativeRootSceneNode);
  if (!sceneNode) {
    return;
  }

  const nodeStack = [{sceneNode, connection: rootConnection}];

  // Traverse the fbx tree in a breadth first order.
  for (const {sceneNode, connection} of nodeStack) {
    for (const c of connection.src.connections) {
      c.pconnection = connection;
      const childSceneNode = createSceneNode(c, connection, relativeRootSceneNode);
      if (childSceneNode) {
        // Only support for OO and OP (partially OP) connections.
        // TODO(miguel): add support for other types of connections.
        // https://download.autodesk.com/us/fbx/20112/fbx_sdk_help/index.html
        switch(c.type) {
          case "OO":
            sceneNode.add(childSceneNode);
            break;
          case "OP":
            // TODO(miguel): this needs to handle proper mapping of
            // object to property updates.
            sceneNode.add(childSceneNode);
            break;
        }

        nodeStack.push({sceneNode: childSceneNode, connection: c});
      }
    }

    sceneManager.updateNodeStateByName(
      sceneNode.name,
      Object.assign({
        name: sceneNode.name,
        type: sceneNode.type,
      }, sceneManager.getNodeStateByName(sceneNode.name)),
    );
  }

  return sceneNode;

  function createSceneNode(connection) {
    const {src, pname} = connection;
    const {node: fbxNode, name} = src;
    let sceneNode;

    switch(fbxNode.name) {
      case "Model": {
        const modelType = fbxNode.attributes[2];

        if (modelType === "Mesh") {
          sceneNode = new Mesh({name});
        } else if (modelType === "LimbNode") {
          sceneNode = new Bone({name}, fbxNode.attributes[0]);
        } else if (modelType === "Null") {
          // Armatures are the root nodes for a bone hierarchy. This is some
          // information about the armature node which seems to cause issues
          // in some engines.
          // https://blenderartists.org/t/fbx-exporter-adds-extra-armature-bone/685994/21
          // https://github.com/A-Ribeiro/CustomBlenderFBXExporter
          //
          // NOTE: Armatures as generated by blender have a type of `Null`.
          sceneNode = new Armature({name});
        } else {
          // eslint-disable-next-line
          console.warn(`===> unknown FBX model type ${modelType}`);
          return null;
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
        const rootState = sceneManager.getNodeStateByName(relativeRootSceneNode.name);

        const {
          vertices,
          indexes,
          tangents,
          bitangents,
          uv,
          normals,
          polygonIndexes,
        } = buildGeometryLayers(fbxNode, rootState.normalSmoothing);

        // We do a quick check on the vertices with the generated indexes
        // to make sure overall things aren't completely broken. This catches
        // things like out of ranges indexes and so on. It does not validate
        // the triangles represented by the indexes yet.
        validateIndexedTriangles(name, vertices, indexes);

        connection.polygonIndexMap = traingleIndexesByPolygonVertex(polygonIndexes);

        const vbo = new VertexBuffer({
          positions: new VertexBufferData(gl, vertices),
          normals: new VertexBufferData(gl, normals),
          tangents: tangents && new VertexBufferData(gl, tangents),
          bitangents: bitangents && new VertexBufferData(gl, bitangents),
          textureCoords: uv && new TextureVertexBufferData(gl, uv),
          // indexes: polygonIndexes && new VertexBufferIndexes(gl, polygonIndexes),
        });

        sceneNode = new Gometry({name}, vbo);
        break;
      }
      case "Deformer": {
        const type = fbxNode.attributes[2];

        if (type === "Skin") {
          sceneNode = new SkinDeformer({name});
        } else if (type === "Cluster") {
          let indexes = findPropertyValueByName(fbxNode, "Indexes");
          const weights = findPropertyValueByName(fbxNode, "Weights");
          const transform  = findPropertyValueByName(fbxNode, "Transform");
          const transformLink  = findPropertyValueByName(fbxNode, "TransformLink");

          if (!indexes) {
            break;
          }

          // Traverse up parent connections until we find the first
          // polygonIndexMap. We do this because clusters can be children
          // or Geometry or Skin Deformers.
          let geometryConnection = connection;
          while (geometryConnection && !geometryConnection.polygonIndexMap) {
            geometryConnection = geometryConnection.pconnection;
          }

          if (geometryConnection) {
            indexes = indexes.map(idx => geometryConnection.polygonIndexMap[idx]);
          }

          sceneNode = new SkinDeformerCluster({name},
            indexes,
            weights,
            new mat4.Matrix4(transform).transpose(),
            new mat4.Matrix4(transformLink).transpose(),
          );
        }
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
        const defaultValues = [];
        const properties70 = findChildByName(fbxNode, "Properties70");
        if (properties70) {
          const transformIndex = {"d|X": 0, "d|Y": 1, "d|Z": 2};
          for (const property of properties70.properties) {
            if (transformIndex.hasOwnProperty(property.value[0])) {
              defaultValues[transformIndex[property.value[0]]] = property.value[4];
            }
          }
        }

        sceneNode = new AnimationCurveNode(pname, defaultValues, {name});
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
        break;
      }
    }

    if (!sceneNode) {
      return null;
    }

    sceneNode.relativeRoot = relativeRootSceneNode;
    return sceneNode.withMatrix(mat4.Matrix4.identity());
  }
}

// parseGeometryLayers builds all the different buffers needed for
// rendering an FBX file. This includes UVs, Normals, and Vertices. The
// semantics include expanding out polygons to triangles to uniformly handle
// quads, triangle fans, and other polygon types.
//
// TODO(miguel): Support triangle fans. It's ultimately less efficient to
// render each triangle individually, especially if the meshes are built using
// triangle fans. However, current implementation in the scene renderer assumes
// everything is a triangle which is good enough for now.
// parseGeometryLayers builds all the different buffers needed for
// rendering a FBX file. This includes UVs, Normals, and Vertices. The
// semantics include expanding out polygons to triangles to uniformly handle
// quads, triangle fans, and other polygon types.
function buildGeometryLayers(fbxGeometry, normalSmoothing) {
  const polygonVertexIndex = findPropertyValueByName(fbxGeometry, "PolygonVertexIndex");
  let polygonVertices = findPropertyValueByName(fbxGeometry, "Vertices");

  // [0, 4, 6, -3] => [0, 4, 6, 0, 6, 2]
  const polygonIndexes = convertPolygonIndexesToTriangleIndexes(polygonVertexIndex);

  // Build out the list of vertices from the triangle indexes. This generates
  // a lot of duplicated vertices, but this is expected because normal vectors
  // often can't be shared so indexing the same coordinate will cause the
  // same normal vertor to be used for polygons that face away from each
  // other and this causes all sorts of issues with lighting.
  const vertices = getIndexedComponents(polygonVertices, polygonIndexes, 3);

  // When we extract indexed triangles from the polygons, the vertices
  // are stored in a sequential order. Normals and all the other layers
  // also get ordered sequentially. So we have to rebuild the polygon
  // indexes to be sequential so that we can extract data from the
  // different layers in the correct order.
  //
  // TODO(miguel): is there a way to avoid remapping indexes so that
  // we can just provide `polygonIndexes` to draw elements? Look
  // out for cube shapes that have normal verctors that cannot be shared;
  // more generally, any shape that has 90 degree angles where normals just
  // point in unsharable directions.
  const indexes = reindexPolygonVertex(polygonVertexIndex);

  // Texture coordinates.
  let uv = getLayerData(fbxGeometry, "UV");

  // Tangent, BiTangent, and Normal vector calculations for normal maps
  // support. These are vectors that are used in the shaders to correctly
  // transform vertices and light positions to and from tangent space, which
  // is the space where normal vectors in normal map textures are defined.
  let tangents, bitangents, normals;
  if (uv && uv.length) {
    // Reindex direct polygon indexes to triangle indexes. This changes
    // the items so that they align with triangles vertices which are
    // sequentially stored.
    uv = getIndexedComponents(uv, indexes, 2);

    const [t,b,n] = getTBNVectorsFromTriangles(vertices, uv, normalSmoothing);
    tangents = t;
    bitangents = b;
    normals = n;
  }

  if (!normals) {
    normals = getLayerData(fbxGeometry, "Normals");
    if (normals) {
      // Reindex direct polygon indexes to triangle indexes. This changes
      // the items so that they align with triangles vertices which are
      // sequentially stored.
      normals = getIndexedComponents(normals, indexes, 3);
    }
  }

  return {
    vertices,
    indexes,
    tangents,
    bitangents,
    uv, normals,
    polygonVertices,
    polygonIndexes,
  };
}

let _idxNameMap = {};
function generateFbxNodeName(fbxNode) {
  const name = getNodeName(fbxNode);
  if (_idxNameMap[name] == null) {
    _idxNameMap[name] = 0;
  } else {
    _idxNameMap[name]++;
  }

  const index = _idxNameMap[name] === 0 ? "" : "_n" + _idxNameMap[name];
  return name + index;
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

function initShaderProgramsForMeshes(gl, sceneNode) {
  findChildrenByType(sceneNode, Mesh).forEach(mesh => {
    const textures = findChildrenByType(mesh, Texture);
    const materials = findChildrenByType(mesh, Material);

    // If the mesh has any textures, then we use phong-texture. We have a
    // separate shader specifically for handling textures because if the
    // a shader defined a sample2D type and does not call the `texture`
    // method in the shader then we get the warning:
    // "there is no texture bound to the unit 0".
    // So we want to make sure we pick a shader that can handle textures
    // if the mesh has any, otherwise use an equivalent shader without
    // texturing.
    const shaderName = textures.length ? "phong-texture" : "phong-lighting";
    mesh.withShaderProgram(createShaderProgram(gl, shaderName));

    // We add a default texture so that objects can be seen by default
    // in a scene. Without this, meshes will be rendered completely black.
    if (!materials.length) {
      mesh.add(new Material({name: "default material"}));
    }
  });
}

function initShaderProgramsForArmatures(gl, sceneNode) {
  findChildrenByType(sceneNode, Armature).forEach(armature => {
    armature.withShaderProgram(createShaderProgram(gl, "flat-material"));
  });
}

// traingleIndexesByPolygonVertex maps polygon indexes (decoded fbx
// geometry indexes PolygonVertexIndex) to indexes that map to the vertices
// we give webgl for rendering. This needs to happen because when we
// process the geometry layers from an FBX file all the vertices are stored
// as sequential vertex coordinates for triangles, which means lots of
// duplicate data. Unlike the decoded PolygonVertexIndex which are not
// sequential and are optimized for sharing vertex coordinates.
export function traingleIndexesByPolygonVertex(indexes) {
  const results = {};

  for (let i = 0; i < indexes.length; i++) {
    let vindex = indexes[i];

    // We just pick the first index since these point to the same vertex.
    if (!results.hasOwnProperty(vindex)) {
      results[vindex] = i;
    }
  }

  return results;
}
