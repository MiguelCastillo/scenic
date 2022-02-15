import * as mat4 from "../../../src/math/matrix4.js";
import * as vec3 from "../../../src/math/vector3.js";

import {
  Node as SceneNode,
} from "../../../src/scene/node.js";

import {
  Renderable as RenderableSceneNode,
} from "../../../src/scene/renderable.js";

import {
  findParentItemsWithItemType,
} from "../../../src/scene/traversal.js";

import {
  animateScalar,
} from "../../../src/animation/keyframe.js";

class Animatable extends RenderableSceneNode {
  constructor(options) {
    super(options);
    this.animationNodes = [];
    this.msOffset = 0;
  }

  add(node) {
    if (node instanceof AnimationCurveNode) {
      this.animationNodes.push(node._withParent(this));
    } else {
      super.add(node);
    }
    return this;
  }

  preRender(context) {
    const animation = getAnimation(context, this);
    if (!animation?.nodes.length) {
      this.currentAnimationStack = null;
      super.preRender(context);
      return;
    }

    // If it's a new animation, then we reset the animation state
    if (this?.currentAnimationStack?.name !== animation.stack.name) {
      this.currentAnimationStack = animation.stack;

      // This offset is to make sure animation starts from the very beginning
      // each time a new animation is activated.
      this.msOffset = animation.ms;
    }

    const {
      translation, rotation, scale,
    } = doKeyFrameAnimation(animation.ms, animation.nodes, animation.speed);

    if (!translation && !rotation && !scale) {
      super.preRender(context);
      return;
    }

    // https://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref__transformations_2main_8cxx_example_html
    let animationMatrix = mat4.Matrix4.identity();

    if (translation) {
      animationMatrix = animationMatrix.translate(translation[0], translation[1], translation[2]);
    }
    if (rotation) {
      animationMatrix = animationMatrix.rotate(rotation[0], rotation[1], rotation[2]);
    }
    if (scale) {
      animationMatrix = animationMatrix.scale(scale[0], scale[1], scale[2]);
    }

    const parent = this.parent;
    if (parent) {
      this.withMatrix(parent.worldMatrix.multiply(animationMatrix));
    } else {
      this.withMatrix(animationMatrix);
    }
  }
}

export class Mesh extends Animatable {
  constructor(options, shaderProgram) {
    super(Object.assign({}, options, {type:"fbx-mesh"}));
    this.vertexBuffers = [];

    if (shaderProgram) {
      this.shaderProgram = shaderProgram.clone();
    }
  }

  withShaderProgram(shaderProgram) {
    this.shaderProgram = shaderProgram.clone();
    return this;
  }

  addVertexBuffer(vertexBuffer) {
    this.vertexBuffers = this.vertexBuffers.concat(vertexBuffer);
    return this;
  }

  preRender(context) {
    this.shaderProgram.setUniforms([]);
    this.vertexBuffers = [];
    super.preRender(context);
  }

  render(context) {
    const {shaderProgram, worldMatrix} = this;
    const {gl, sceneManager} = context;
    const projectionMatrix = this.getProjectionMatrix();

    // Quick hack to make bump lighting configurable in the scene config.
    // We read from the parent because that's the node that is created
    // with the scene configuration state. All FBX nodes are created and
    // added to the scene separately, so they currently don't have their
    // state configurable in the scene config.
    const parentNodeState = sceneManager.getNodeStateByName(this.parent.name);
    let bumpLightingEnabled = false;

    if (parentNodeState && parentNodeState.material) {
      bumpLightingEnabled = parentNodeState.material.bumpLighting === true;
    }

    const lightsStates = findParentItemsWithItemType(this, "light")
      .map(({name}) => sceneManager.getNodeStateByName(name));

    const lightPositions = lightsStates
      .map(({transform: {position}}, idx) => ({
        name: `lights[${idx}].position`,
        update: ({index}) => {
          gl.uniform3fv(index, vec3.normalize(...position));
        },
      }));

    const lightColors = lightsStates
      .map(({light: {color}}, idx) => ({
        name: `lights[${idx}].color`,
        update: ({index}) => {
          gl.uniform3fv(index, color);
        }
      }));

    const lightIntensities = lightsStates
      .map(({light: {intensity}}, idx) => ({
        name: `lights[${idx}].intensity`,
        update: ({index}) => {
          gl.uniform1f(index, intensity);
        },
      }));

    const lightEnabled = lightsStates
      .map((_, idx) => ({
        name: `lights[${idx}].enabled`,
        update: ({index}) => {
          gl.uniform1i(index, 1);
        },
      }));

    // Configure shader program with its current state.
    const program = shaderProgram
      .addUniforms([{
          name: "projectionMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, false, projectionMatrix.data);
          },
        }, {
          name: "worldMatrix",
          update: ({index}) => {
            gl.uniformMatrix4fv(index, false, worldMatrix.data);
          },
        }, {
          name: "bumpLighting",
          update: ({index}) => {
            gl.uniform1i(index, bumpLightingEnabled);
          },
        },
        ...lightPositions,
        ...lightColors,
        ...lightIntensities,
        ...lightEnabled,
      ]);

    this.vertexBuffers.forEach(vb => {
      RenderableSceneNode.render(gl, program, vb);
    });
  }
}

export class Armature extends Animatable {
  constructor(options) {
    super(Object.assign({}, options, {type:"fbx-armature"}));
  }
}

export class Bone extends Animatable {
  constructor(options) {
    super(Object.assign({}, options, {type:"fbx-bone"}));
  }
}

export class Gometry extends SceneNode {
  constructor(options, vertexBuffer, polygonVertexIndexes) {
    super(Object.assign({}, options, {type:"fbx-geometry"}));
    this.vertexBuffer = vertexBuffer;
    this.polygonVertexIndexes = polygonVertexIndexes;
    this.skinDeformers = [];
    this.enableSkinning = false;
  }

  add(node) {
    if (node instanceof SkinDeformer) {
      this.skinDeformers.push(node._withParent(this));
    } else {
      super.add(node);
    }
    return this;
  }

  render() {
    let mesh = findParentMesh(this);
    if (mesh) {
      if (this.enableSkinning === true && this.skinDeformers.length) {
        // These deformers are things like a skin deformer which has
        // cluster deformers as children nodes. These clusters are the
        // things that have the indexes to vertices that are affected
        // by the deformations.
        for (const skin of this.skinDeformers) {
          for (const cluster of skin.items) {
            mesh.addVertexBuffer(this.vertexBuffer.clone().withIndexes(cluster.indexes));
          }
        };
      } else {
        mesh.addVertexBuffer(this.vertexBuffer);
      }
    }
  }
}

export class SkinDeformer extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type:"fbx-skin-deformer"}));
  }
}

export class SkinDeformerCluster extends SceneNode {
  constructor(options, indexes, weights) {
    super(Object.assign({}, options, {type:"fbx-skin-deformer-cluster"}));
    this.indexes = indexes;
    this.weights = weights;
  }
}

export class AnimationStack extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type: "fbx-animation-stack"}));
    this.animationLayers = [];
  }

  add(node) {
    this.animationLayers.push(node);
    return this;
  }
}

export class AnimationLayer extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type: "fbx-animation-layer"}));
    this.animationCurveNodesByName = {};
    this.animationCurveNodes = [];
  }

  add(node) {
    if (this.animationCurveNodesByName[node.name]) {
      // eslint-disable-next-line
      console.warn(`animation node ${node.name} already exists in ${this.name}`);
    } else {
      this.animationCurveNodesByName[node.name] = node.name;
    }

    this.animationCurveNodes.push(node);
    return this;
  }
}

// https://download.autodesk.com/us/fbx/20112/FBX_SDK_HELP/index.html?url=WS1a9193826455f5ff45564f421269b08a8e9-56a4.htm,topicNumber=d0e6863
export class AnimationCurveNode extends SceneNode {
  constructor(pname, defaultValues, options) {
    super(Object.assign({}, options, {type: "fbx-animation-node"}));
    this.pname = pname;
    this.defaultValues = defaultValues;
  }

  getValues(ms, speed) {
    return [this.pname, ...this.items.map(item => item.getValue(ms, speed))];
  }
}

export class AnimationCurve extends SceneNode {
  constructor(times, values, pname, options) {
    super(Object.assign({}, options, {type: "fbx-animation-curve"}));
    this.times = times;
    this.values = values;
    this.pname = pname;
    this.animate = animateScalar(values, times);
  }

  getValue(ms, speed) {
    // 46186158000 is an FBX second.
    // #define KTIME_ONE_SECOND KTime (K_LONGLONG(46186158000))
    // https://github.com/mont29/blender-io-fbx/blob/ea45491a84b64f7396030775536be562bc118c41/io_scene_fbx/export_fbx.py#L2447
    // https://download.autodesk.com/us/fbx/docs/FBXSDK200611/wwhelp/wwhimpl/common/html/_index.htm?context=FBXSDK_Overview&file=ktime_8h-source.html
    return [this.pname, this.animate(46186158000*(ms*0.001), speed)];
  }
}

export class Material extends SceneNode {
  constructor(options, materialColor=[0.5,0.5,0.5,1], ambientColor=[1,1,1], reflectionFactor=1) {
    super(Object.assign({}, options, {type:"fbx-material"}));
    this.materialColor = materialColor;
    this.ambientColor = ambientColor;
    this.reflectionFactor = reflectionFactor;
  }

  withAmbientColor(ambientColor) {
    this.ambientColor = ambientColor;
    return this;
  }

  withMaterialColor(materialColor) {
    this.materialColor = materialColor;

    if (materialColor.length === 3) {
      this.materialColor[3] = 1;
    }

    return this;
  }

  withReflectionFactor(reflectionFactor) {
    this.reflectionFactor = reflectionFactor;
    return this;
  }

  render(context) {
    const mesh = findParentMesh(this);

    if (mesh) {
      const {gl} = context;

      mesh.shaderProgram.addUniforms([{
        name: "ambientColor",
        update: ({index}) => {
          gl.uniform3fv(index, this.ambientColor);
        }
      }, {
        name: "materialReflectiveness",
        update: ({index}) => {
          gl.uniform1f(index, this.reflectionFactor);
        },
      }, {
        name: "materialColor",
        update: ({index}) => {
          gl.uniform4fv(index, this.materialColor);
        },
      }]);
    }
  }
}

// The code in the Texture is basically all lifted from:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
export class Texture extends SceneNode {
  constructor(textureID, type, options) {
    super(Object.assign({}, options, {type: "fbx-texture"}));
    this.textureID = textureID;
    this.type = type;
  }

  load(gl, filepath) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel);

    getImage(filepath).then(image => {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        srcFormat,
        srcType,
        image);

      // WebGL1 has different requirements for power of 2 images
      // vs non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        // Yes, it's a power of 2. Generate mips.
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        // No, it's not a power of 2. Turn off mips and set
        // wrapping to clamp to edge
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
    });

    return this;
  }

  clone() {
    const newtexturenode = new Texture(
      this.textureID,
      this.type,
      {name: this.name});

    newtexturenode.texture = this.texture;
    return newtexturenode;
  }

  render(context) {
    let mesh = findParentMesh(this);

    if (mesh) {
      const {gl} = context;
      const {textureID, type} = this;

      if (type === "normalmap") {
        mesh.shaderProgram.addUniforms([
          {
            name: `${type}.enabled`,
            update: ({index}) => {
              gl.uniform1i(index, 1);
            },
          }, {
            name: `${type}.id`,
            update: ({index}) => {
              gl.activeTexture(gl.TEXTURE0 + textureID);
              gl.bindTexture(gl.TEXTURE_2D, this.texture);
              gl.uniform1i(index, textureID);
            },
          }
        ]);
      } else {
        mesh.shaderProgram.addUniforms([
          {
            name: `textures[${textureID}].enabled`,
            update: ({index}) => {
              gl.uniform1i(index, 1);
            },
          }, {
            name: `textures[${textureID}].id`,
            update: ({index}) => {
              gl.activeTexture(gl.TEXTURE0 + textureID);
              gl.bindTexture(gl.TEXTURE_2D, this.texture);
              gl.uniform1i(index, textureID);
            },
          }
        ]);
      }
    }
  }
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

const _imageCache = {};
function getImage(filepath) {
  if (!_imageCache[filepath]) {
    _imageCache[filepath] = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.src = filepath;
    });
  }

  return _imageCache[filepath]
}

// We only support animation transform matrices, which are used for bone
// animation.
function doKeyFrameAnimation(ms, animationNodes, animationSpeed) {
  const animationResult = {};

  const animationChannels = {};
  animationNodes.forEach(animation => {
    const [pname, ...result] = animation.getValues(ms, animationSpeed);
    animationChannels[pname] = {
      result, defaults: animation.defaultValues,
    };
  });

  const translation = animationChannels["Lcl Translation"];
  if (translation) {
    animationResult["translation"] = getTransformAnimation(translation.result, translation.defaults);
  }

  const rotation = animationChannels["Lcl Rotation"];
  if (rotation) {
    animationResult["rotation"] = getTransformAnimation(rotation.result, rotation.defaults);
  }

  const scaling = animationChannels["Lcl Scaling"];
  if (scaling) {
    animationResult["scale"] = getTransformAnimation(scaling.result, scaling.defaults);
  }

  return animationResult;
}

const transformIndex = {"d|X": 0, "d|Y": 1, "d|Z": 2};
function getTransformAnimation(animation, defaultValues) {
  const transform = [...defaultValues];
  for (let i = 0; i < animation.length; i++) {
    transform[transformIndex[animation[i][0]]] = animation[i][1];
  }
  return transform;
}

function getAnimation(context, node) {
  // Right now the relativeRoot would have the animation node where
  // all the animation information exists. That's where we find
  // the animation stacks and the layers that determine the animation
  // to run. There is only _ONE_ animation node.
  // Ideally each mesh would have their own animation node, but FBX
  // doesn't seem to work that way. Instead we have all the animation
  // stacks in a single animation node and all the renderables can
  // look up their own animation data based on the current stack.
  const animationNode = node.relativeRoot.animation;
  if (!animationNode?.items.length) {
    return;
  }

  const animationState = context.sceneManager.getNodeStateByName(animationNode.name);
  if (!animationState?.stackName) {
    return;
  }

  let stack = node.currentAnimationStack;
  if (stack?.name !== animationState.stackName) {
    stack = animationNode.items.find(item => item.name === animationState.stackName);
    if (!stack) {
      return;
    }
  }

  // TODO(miguel): figure out semantics for dealing with multiple
  // layers. Perhaps blend them? Override?
  // For now, pick first layer for now.
  const layer = stack.animationLayers[0];
  const nodes = node.animationNodes.filter(n => layer.animationCurveNodesByName[n.name]);
  const speed = animationState.speed == null ? 1 : animationState.speed;
  const ms = animationState.ms == null ? context.ms : animationState.ms;

  return {
    stack, nodes, speed, ms,
  };
}

function findParentMesh(node) {
  let mesh = node.parent;
  while (mesh && !(mesh instanceof Mesh)) {
    mesh = mesh.parent;
  }
  return mesh;
}

export function findMeshes(sceneNode) {
  const meshes = [];

  function traverse(node) {
    if (!node) {
      return;
    }

    if (node instanceof Mesh) {
      meshes.push(node);
    }

    node.items.forEach(traverse);
  }

  traverse(sceneNode);
  return meshes;
}

export function findMeshChildrenByType(mesh, ChildType) {
  const children = [];
  function traverse(node) {
    if (!node || node instanceof Mesh) {
      return;
    }

    if (node instanceof ChildType) {
      children.push(node);
    }

    node.items.forEach(traverse);
  }

  mesh.items.forEach(traverse);
  return children;
}
