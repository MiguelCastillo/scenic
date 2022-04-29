import * as mat4 from "../../../src/math/matrix4.js";

import {getTBNVectorsFromTriangles} from "../../../src/math/tbn-matrix.js";

import {getIndexedComponents} from "../../../src/math/geometry.js";

import {createShaderProgram} from "../../shader-factory.js";

import {findChildrenByType} from "../../../src/scene/node.js";

import {
  VertexBuffer,
  VertexBufferData,
  TextureVertexBufferData,
  VertexBufferIndexes,
} from "../../../src/renderer/vertexbuffer.js";

import {BrinaryFileLoader} from "../base-loader.js";

import {
  FbxFile,
  getNodeName,
  findChildByName,
  findChildrenByName,
  findPropertyValueByName,
  decodePolygonVertexIndexes,
  polygonVertexIndexToDirect,
} from "../../../src/formats/fbxfile.js";

import {Animation as AnimationSceneNode} from "../../../src/scene/animation.js";

import {Material as MaterialSceneNode} from "../../../src/scene/material.js";

import {
  Mesh,
  Geometry,
  SkinDeformer,
  SkinDeformerCluster,
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
    return super.load(file).then((content) => FbxFile.fromBinary(content));
  }
}

// FBX models fps default of 24 frames per second.
const FBX_DEFAULT_FPS = 24;

let animationID = 0;

// We cache some extra information from the FBX file that is needed after
// the file is processed. For example, we need vertex indexing information for
// skin animation.
//
// TODO(miguel): rework FBX connection processing so that we don't have these
// lingering global variables hanging without context.
const _clusterMetadata = {};
const _geometryMetadata = {};

// We cache textures by filename so that if different parts of an FBX file
// needs the same texture we can just use what's already cache instead.
const _textureCache = {};

export function buildSceneNode(gl, fbxDocument, sceneNode, sceneManager) {
  sceneNode.clear();

  const nodeWrappersByID = {
    "0,0": {
      connections: [],
    },
  };

  const globalSettings = findChildByName(fbxDocument, "GlobalSettings");

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
    switch (props.name) {
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
      .map((connection) => sceneNodeFromConnection(gl, connection, sceneManager, sceneNode))
      .filter(Boolean)
  );

  const animationNode = new AnimationSceneNode({name: `Animation_n${animationID++}`});
  findChildrenByName(objects, "AnimationStack")
    .map((s) => s.attributes[0])
    .forEach((stackID) => {
      const animationStack = new AnimationStack({
        name: nodeWrappersByID[stackID].name,
      });

      animationNode.add(
        animationStack.addItems(
          nodeWrappersByID[stackID].connections
            .map((connection) => sceneNodeFromConnection(gl, connection, sceneManager, sceneNode))
            .filter(Boolean)
        )
      );
    });

  if (animationNode.items.length) {
    sceneNode.add(animationNode);

    ////////////
    // Initialize the state for the animation node

    // fps in an FBX file is a property in the global settings and it looks like
    // ['CustomFrameRate', 'double', 'Number', '', 24]
    const properties70 = findChildByName(globalSettings, "Properties70");
    const frameRate = properties70.properties.find((p) => p.value[0] === "CustomFrameRate");
    const fps = frameRate?.value[4];

    const {animation = {}} = sceneManager.getNodeStateByID(sceneNode.id);
    sceneManager.updateNodeStateByID(animationNode.id, {
      ...animation,
      // Order of presedence for FPS is first custom, then fbx file, then just
      // known default.
      fps: animation.fps || fps || FBX_DEFAULT_FPS,
      stackNames: animationNode.items.map((item) => item.name),
    });
  }

  // Armature is basically the root bone of a skeleton in a rigged animation.
  // We want to make sure we have one in the scene node if there is skeletal
  // animation and there is no armature.
  buildArmature(sceneNode);

  // After the armature is built, we will then initialize all the internal
  // bone indexes and weights for geometry deformation.
  buildSkinAnimation(gl, sceneNode);

  // We want to find all the meshes and initialize shader programs for each.
  initShaderProgramsForMeshes(gl, sceneNode);
  initShaderProgramsForArmatures(gl, sceneNode);
}

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
        switch (c.type) {
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

    sceneManager.updateNodeStateByID(sceneNode.id, {
      name: sceneNode.name,
      type: sceneNode.type,
      ...sceneManager.getNodeStateByID(sceneNode.id),
    });
  }

  return sceneNode;

  function createSceneNode(connection) {
    const {src, pname} = connection;
    const {node: fbxNode, name} = src;
    let sceneNode;

    switch (fbxNode.name) {
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

        let rotation = [0, 0, 0];
        let translation = [0, 0, 0];
        let scale = [1, 1, 1];

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

        sceneManager.updateNodeStateByID(sceneNode.id, {
          transform: {
            rotation: rotation,
            position: translation,
            scale: scale,
          },
        });

        break;
      }
      case "Geometry": {
        const rootState = sceneManager.getNodeStateByID(relativeRootSceneNode.id);

        const {vertices, indexes, tangents, bitangents, uv, normals, polygonIndexes} =
          buildGeometryLayers(fbxNode, rootState.normalSmoothing);

        // We do a quick check on the vertices with the generated indexes
        // to make sure overall things aren't completely broken. This catches
        // things like out of ranges indexes and so on. It does not validate
        // the triangles represented by the indexes yet.
        validateIndexedTriangles(name, vertices, indexes);

        // This map allows us to convert from decoded FBX polygon indexes
        // to direct indexes, which is what we use for rendering.
        connection.polygonIndexToRenderIndexMap = polygonVertexIndexesToRenderIndexes(
          polygonIndexes,
          indexes
        );
        _geometryMetadata[name] = {
          renderIndexToPolygonMap: polygonVertexIndexesToRenderIndexes(indexes, polygonIndexes),
        };

        const vbo = new VertexBuffer({
          // The only things that's required here is `positions` and that's
          // because those are the vertices for the geometry itself. If there
          // are no vertices then there is no point in having a geometry node.
          positions: new VertexBufferData(gl, vertices),
          normals: normals && new VertexBufferData(gl, normals),
          tangents: tangents && new VertexBufferData(gl, tangents),
          bitangents: bitangents && new VertexBufferData(gl, bitangents),
          textureCoords: uv && new TextureVertexBufferData(gl, uv),
          indexes: indexes && new VertexBufferIndexes(gl, indexes),
        });

        sceneNode = new Geometry({name}, vbo);
        break;
      }
      case "Deformer": {
        const type = fbxNode.attributes[2];

        if (type === "Skin") {
          sceneNode = new SkinDeformer({name});
        } else if (type === "Cluster") {
          let indexes = findPropertyValueByName(fbxNode, "Indexes");
          const weights = findPropertyValueByName(fbxNode, "Weights");
          const transform = findPropertyValueByName(fbxNode, "Transform");
          const transformLink = findPropertyValueByName(fbxNode, "TransformLink");

          if (!indexes) {
            break;
          }

          _clusterMetadata[name] = {
            polygonVertexIndexes: indexes,
          };

          // Traverse up parent connections until we find the first
          // polygonIndexToRenderIndexMap. We do this because clusters can be
          // children or Geometry or Skin Deformers.
          let geometryConnection = connection;
          while (!geometryConnection?.polygonIndexToRenderIndexMap) {
            geometryConnection = geometryConnection.pconnection;
          }

          if (geometryConnection) {
            indexes = indexes.map((idx) => geometryConnection.polygonIndexToRenderIndexMap[idx]);
          }

          sceneNode = new SkinDeformerCluster(
            {name},
            indexes,
            weights,
            new mat4.Matrix4(transform).transpose(),
            new mat4.Matrix4(transformLink).transpose()
          );
        }
        break;
      }
      case "Material": {
        sceneNode = new MaterialSceneNode({name});

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
        times = times.map((t) => parseInt(t));
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
    return sceneNode.withWorldMatrix(mat4.Matrix4.identity());
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
  const polygonIndexes = decodePolygonVertexIndexes(polygonVertexIndex);

  // In an FBX file, there are multiple ways in which data can be stored which
  // is optimal for different situations. These are defined by a combination of
  // ReferenceInformationType and MappingInformationType.
  // And this is complicated by the fact that vertices are indexed to optimize
  // for vertices sharing because this causes issues with normal vectors. For
  // exmaple, say you have two polygons that share the same vertex but are
  // facing the opposite direction. This means that normal vectors face opposite
  // direction. If we were to use polygong indexes the way that FBX stores them
  // we end up with the same normal vector for these two faces causing all sorts
  // of issues with collision detection and lighting.
  //
  // This means that we really cannot use polygon indexes as the canonical way
  // to index data.
  //
  // To solve this problem we use the same indexing that Normal vectors usually
  // have, which is Direct indexing. These are just sorted indexes that map to
  // the order in which PolygonVertexIndex is stored which is the index for the
  // polygon itself and not the vertex.
  //
  // See tests for decodePolygonVertexIndexes and polygonVertexIndexToDirect to
  // better understand the differences between them.
  //
  // [0, 4, 6, -3] => [0, 1, 2, 0, 2, 3]
  //
  const renderIndexes = polygonVertexIndexToDirect(polygonVertexIndex);

  // We remap vertices indexed with decoded polygon indexes to  render indexes,
  // which are suitable for indexing normal vectors.
  const vertices = mapPolygonIndexToRenderIndex(polygonVertices, polygonIndexes, renderIndexes);

  // Texture coordinates.
  let uv = getLayerData(fbxGeometry, "UV");

  // Tangent, BiTangent, and Normal vector calculations for normal maps
  // support. These are vectors that are used in the shaders to correctly
  // transform vertices and light positions to and from tangent space, which
  // is the space where normal vectors in normal map textures are defined.
  let tangents, bitangents, normals;
  // TODO(miguel): add support for indexes when creating TBN vectors
  // for bump lighting.
  //
  if (uv && uv.length) {
    const [t, b, n] = getTBNVectorsFromTriangles(vertices, uv, renderIndexes, normalSmoothing);
    tangents = t;
    bitangents = b;
    normals = n;
  }

  if (!normals) {
    normals = getLayerData(fbxGeometry, "Normals");
  }

  return {
    vertices,
    indexes: renderIndexes,
    tangents,
    bitangents,
    uv,
    normals,
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
  console.log(
    name,
    "triangle count",
    indexes.length / 3,
    "index count",
    indexes.length,
    "vertex count",
    vertices.length
  );

  let min = 0,
    max = 0;
  for (let i = 0; i < indexes.length; i += 3) {
    const i1 = indexes[i];
    const i2 = indexes[i + 1];
    const i3 = indexes[i + 2];
    min = Math.min(min, i1, i2, i3);
    max = Math.max(max, i1, i2, i3);

    if (i1 === undefined || i2 === undefined || i3 === undefined) {
      // eslint-disable-next-line
      console.log("===> invalid vertex index ", i, i1, i2, i3);
    }
    if (vertices[i1] === undefined || vertices[i2] === undefined || vertices[i3] === undefined) {
      // eslint-disable-next-line
      console.log(
        "===> vertex index out of bound",
        i,
        vertices[i1],
        vertices[i2],
        vertices[i3],
        i1,
        i2,
        i3
      );
    }
  }

  // eslint-disable-next-line
  console.log("===> index min", min, "index max", max);
}

const layerMap = {
  UV: {
    layerName: "LayerElementUV",
    indexName: "UVIndex",
    data: "UV",
    componentsPerVertex: 2,
  },
  Normals: {
    layerName: "LayerElementNormal",
    indexName: "NormalsIndex",
    data: "Normals",
    componentsPerVertex: 3,
  },
  Colors: {
    layerName: "LayerElementColor",
    indexName: "ColorIndex",
    data: "Colors",
    componentsPerVertex: 4,
  },
};

function getLayerData(fbxGeometry, layerDataName) {
  const layer = findChildByName(fbxGeometry, layerMap[layerDataName].layerName);
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
    const indexes = findPropertyValueByName(layer, layerMap[layerDataName].indexName);
    components = getIndexedComponents(components, indexes, componentsPerVertex);
  }

  // We do not need to deal with ByPolygonVertex here because things are
  // reindexed later on.
  const mappingInformationType = findPropertyValueByName(layer, "MappingInformationType");
  if (mappingInformationType === "ByPolygonVertex") {
    // This is already the default that we use. So this is a NOOP.
  } else if (mappingInformationType === "ByVertice" || mappingInformationType === "ByVertex") {
    // TODO(miguel): when normals are ByVertice, does that mean that normals
    // won't break if they are indexed with polygon indexes that share vertices?
    // Usually vertices can't share indexes too well when polygons have sharp
    // angles (90 + degrees).
    const polygonVertexIndex = findPropertyValueByName(fbxGeometry, "PolygonVertexIndex");

    components = mapPolygonIndexToRenderIndex(
      components,
      decodePolygonVertexIndexes(polygonVertexIndex),
      polygonVertexIndexToDirect(polygonVertexIndex)
    );
  } else {
    // TODO(miguel): add support for ByPolygon, ByEdge, AllSame when the need
    // comes up.
    // eslint-disable-next-line no-console
    console.warn(
      `FBX MappingInformationType "${mappingInformationType}" is not supported. ${layerDataName}`
    );
  }

  return components;
}

// We only support four bones per vertex.
const MAX_BONES_PER_VERTEX = 4;

// buildSkinAnimation calculats all the bone weights and vertex indexes that
// affect vertices in a geometry node. These weights a vertex indexes are
// provided to vertex shader for rigged animation with skin deformation.
// We only support up to 4 bones per vertex. If we there are less than 4 bones
// for a vertex, then we fill in the rest with 0s. If there are more than 4
// bones for a vertex, then we will ONLY pick the 4 with the most influence
// on the vertex and drop the rest.
export function buildSkinAnimation(gl, sceneNode) {
  for (const geometry of findChildrenByType(sceneNode, Geometry)) {
    const bonedata = {};

    // All the bone weights for a particular vertex are usually scattered across
    // multiple clusters; clusters are children of skin deformers that group
    // weights for how much bones influence vertices. So we go thru all the
    // these clusters and aggregate all the weight for every vertex by the
    // vertex index.
    for (const skin of findChildrenByType(geometry, SkinDeformer)) {
      for (let i = 0; i < skin.items.length; i++) {
        const cluster = skin.items[i];
        // boneIndex matches the bone matrices in vertex shader
        cluster.withBoneIndex(i);

        // In an FBX file, vertices in a geometry node are indexed and the
        // indexes are stored in a property called polygonVertexIndexes.
        // Clusters store the indexes of the vertices they affect; they also
        // store how much as weights. The idea here is to go thru all the
        // clusters to aggregate all the vertices (by index) that they affect,
        // as well as how much a cluster affects these vertices.
        // One catch is that clusters get their indexes remapped to "render
        // indexes" (indexes that can be used for rendering with normal vectors)
        // when scene nodes are created when first processing FBX nodes.
        // 1. Why do we reindex clusters? Because vertices are reindexed.
        // 2. Why do we reindex geometry vertices? Because vertex indexes
        // in an FBX file are optimized for vertex sharing. Meaing, a vertex
        // can be used by multiple faces regardless of where the faces point
        // to. However, normal vectors (which are calculated per vertex) are
        // per face. If we were to use the same index for a vertex that is
        // shared by multiple faces, the normal vector at that index will be
        // the same for every face. Imagine that we have vertex X at index 0.
        // That vertex is used in 3 different faces pointing in different
        // direction. If we were to use normal at index 0 for that vertex then
        // we end up using the same normal vector for multiple different faces.
        // And this causes issues with lighting.
        // To ensure that vertices and normals can be indexed without this
        // problem, we create indexes per face.
        //
        // So when we go thru each cluster finding vertex indexes, we need to
        // use polygonVertexIndexes to identify all the vertices in each
        // cluster.
        const polygonVertexIndexes = _clusterMetadata[cluster.name].polygonVertexIndexes;

        for (let j = 0; j < polygonVertexIndexes.length; j++) {
          const polygonVertexIndex = polygonVertexIndexes[j];

          if (!bonedata[polygonVertexIndex]) {
            bonedata[polygonVertexIndex] = {
              weights: [],
              boneids: [],
            };
          }

          bonedata[polygonVertexIndex].weights.push(cluster.weights[j]);
          bonedata[polygonVertexIndex].boneids.push(cluster.boneIndex);
        }
      }
    }

    Object.keys(bonedata).forEach((polygonVertexIndex) => {
      const len = bonedata[polygonVertexIndex].weights.length;

      // weights and boneids have the same size, so let's pick one to determine
      // the number of each we have. If we have fewer than MAX then we want to
      // fill them in so that the vertex shader can have the correct amount
      // of data.
      // If we have more than MAX than we do some extra work to figure out which
      // bones to keep.
      for (let j = 0; j < MAX_BONES_PER_VERTEX - len; j++) {
        bonedata[polygonVertexIndex].weights.push(0);
        bonedata[polygonVertexIndex].boneids.push(0);
      }

      // We only support up to 4 bones worth of data per vertex. If we have
      // more than that, then we log a wanrning. And we keep the 4 bones with
      // the most influence (heaviest bones) and drop the rest.
      if (len > MAX_BONES_PER_VERTEX) {
        // eslint-disable-next-line no-console
        console.warn(`bone with more than ${MAX_BONES_PER_VERTEX} weights.`, geometry.name, len);

        // These are the weights and indexes for the bones with most influence.
        const {weights, boneids} = getMostInfluencialBones(bonedata[polygonVertexIndex]);
        bonedata[polygonVertexIndex].weights = weights;
        bonedata[polygonVertexIndex].boneids = boneids;
      }
    });

    if (Object.keys(bonedata).length) {
      const mappedweights = [];
      const mappedboneids = [];
      geometry.vertexBuffer.indexes.data.forEach((idx) => {
        // We take all the shared vertex indexes and weights and store them
        // with "render indexes" so that we can use the same indexes we use
        // for rendering vertices and normal vectors.
        const polygonVertexIndex = _geometryMetadata[geometry.name].renderIndexToPolygonMap[idx];
        mappedweights[idx] = bonedata[polygonVertexIndex].weights;
        mappedboneids[idx] = bonedata[polygonVertexIndex].boneids;
      });

      geometry.vertexBuffer.withWeights(
        new VertexBufferData(gl, mappedweights.flat(), MAX_BONES_PER_VERTEX)
      );
      geometry.vertexBuffer.withBoneIDs(
        new VertexBufferData(gl, mappedboneids.flat(), MAX_BONES_PER_VERTEX)
      );
    }
  }
}

// getMostInfluencialBones iterates through weights and boneids selecting the
// most influencial weights; the weights with higher values. We keep the
// 4 heaviest bones and for now just drop the rest.
export function getMostInfluencialBones({weights, boneids}) {
  const rweights = [],
    rboneids = [];

  weights
    .map((w, i) => [w, boneids[i]])
    .sort(([w1], [w2]) => (w1 > w2 ? -1 : 1))
    .slice(0, MAX_BONES_PER_VERTEX)
    .forEach(([w, id]) => {
      rweights.push(w);
      rboneids.push(id);
    });

  return {
    weights: rweights,
    boneids: rboneids,
  };
}

// buildArmature ensures that we have an armature node in the scene to
// encapsulate and manage the skeletal animation bones. An Armature node
// is the root bone of a skeletal animation, but this is sometimes missing
// fomr files because armature is a blender specific thing but it is quite
// useful in practice we are just going to use that term instead of adding
// another special RootBone type of scene node.
// buildArmature also sorts nodes to ensure that the armature is the first
// child in the scene node we are processing. And that's because we need to
// process all the bones in the animation before any other scene node that
// relies on the animation data generated from rendering the armature.
// TODO(miguel): find a better way to ensure armature nodes are always
// processed before all other nodes in the scene node we are processing
// in this function.
function buildArmature(sceneNode) {
  // Blender adds a type of Bone node called Armature that is the root
  // node of a skeleton. But if the FBX file being loaded doesn't have
  // an armature, we insert a fake one.
  let armature = sceneNode.items.find((x) => x instanceof Armature);
  if (!armature) {
    const rootBone = sceneNode.items.find((x) => x instanceof Bone);

    // If there is a skeletal bone, then we have skeletal animation. And we
    // will insert an armature node to orchestrate things for us.
    if (rootBone) {
      armature = new Armature({name: "Default - Armature"});
      armature.relativeRoot = sceneNode;
      sceneNode.remove(rootBone).add(armature);
      armature.add(rootBone);
    }
  }

  if (armature) {
    // We make sure that Armature is the fisrt node so that it can be the first
    // one to be preRendered so that all other nodes that depend on a bone by
    // reference can find the bone already updated for the scene.
    sceneNode.items.sort((a, b) => {
      if (a instanceof Armature) {
        return -1;
      } else if (b instanceof Armature) {
        return 1;
      }
      return 0;
    });
  }
}

function initShaderProgramsForMeshes(gl, sceneNode) {
  findChildrenByType(sceneNode, Mesh).forEach((mesh) => {
    const textures = findChildrenByType(mesh, Texture);
    const materials = findChildrenByType(mesh, MaterialSceneNode);

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
      mesh.add(new MaterialSceneNode({name: "default material"}));
    }
  });
}

function initShaderProgramsForArmatures(gl, sceneNode) {
  findChildrenByType(sceneNode, Armature).forEach((armature) => {
    armature.withShaderProgram(createShaderProgram(gl, "flat-material"));
  });
}

// polygonVertexIndexesToRenderIndexes maps polygon indexes to indexes that
// map to the vertices we give webgl for rendering. This needs to happen
// because when we process the geometry layers from an FBX file all the
// vertices are stored as sequential vertex coordinates for triangles, which
// means lots of duplicate data. Unlike the decoded PolygonVertexIndex which
// are not sequential and are optimized for sharing vertex coordinates.
export function polygonVertexIndexesToRenderIndexes(polygonIndexes, renderIndexes) {
  const results = {};
  for (let i = 0; i < renderIndexes.length; i++) {
    results[polygonIndexes[i]] = renderIndexes[i];
  }
  return results;
}

function mapPolygonIndexToRenderIndex(components, polygonIndexes, renderIndexes) {
  const newComponents = [];
  for (let i = 0; i < polygonIndexes.length; i++) {
    const polygonIndexOffset = polygonIndexes[i] * 3;
    const renderIndexOffset = renderIndexes[i] * 3;
    for (let j = 0; j < 3; j++) {
      newComponents[renderIndexOffset + j] = components[polygonIndexOffset + j];
    }
  }
  return newComponents;
}
