import * as mat4 from "../../../src/math/matrix4.js";

import {VertexBuffer, VertexBufferData} from "../../../src/renderer/vertexbuffer.js";
import {Node as SceneNode, findParentByType, findChildrenByType} from "../../../src/scene/node.js";
import {Mesh as MeshSceneNode} from "../../../src/scene/mesh.js";
import {Renderable as RenderableSceneNode} from "../../../src/scene/renderable.js";
import {Animation as AnimationSceneNode} from "../../../src/scene/animation.js";
import {animateScalar} from "../../../src/animation/keyframe.js";
import {Playback as AnimationPlayback} from "../../../src/animation/playback.js";

// 46186158000 is an FBX second.
// #define KTIME_ONE_SECOND KTime (K_LONGLONG(46186158000))
// https://github.com/mont29/blender-io-fbx/blob/ea45491a84b64f7396030775536be562bc118c41/io_scene_fbx/export_fbx.py#L2447
// https://download.autodesk.com/us/fbx/docs/FBXSDK200611/wwhelp/wwhimpl/common/html/_index.htm?context=FBXSDK_Overview&file=ktime_8h-source.html
const KTIME_ONE_SECOND = 46186158000;

const AnimatableInterface = (superclass) =>
  class extends superclass {
    constructor(options) {
      super(options);
      this.animationNodes = [];
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
      if (!animation) {
        super.preRender(context);
        return;
      }

      const {transform} = context.sceneManager.getNodeStateByID(this.id);

      const {
        translation = transform.position,
        rotation = transform.rotation,
        scale = transform.scale,
      } = animation;

      // https://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref__transformations_2main_8cxx_example_html
      let animationMatrix = mat4.Matrix4.trs(translation, rotation, scale);

      const parent = this.parent;
      if (parent) {
        this.withWorldMatrix(parent.worldMatrix.multiply(animationMatrix));
      } else {
        this.withWorldMatrix(animationMatrix);
      }
    }
  };

export class Animation extends AnimationSceneNode {
  constructor(options) {
    super(options);
    this.stacks = [];
    this.currentStack;
  }

  add(node) {
    if (node instanceof AnimationStack) {
      this.stacks.push(node._withParent(this));
    } else {
      super.add(node);
    }
    return this;
  }

  preRender(context) {
    const animationState = context.sceneManager.getNodeStateByID(this.id);
    const stackName = animationState?.stackName;

    if (!stackName) {
      this.currentStack = this.stacks[0];
    } else if (this.currentStack?.name !== stackName) {
      this.currentStack = this.stacks.find((stack) => stack.name === stackName);
      this.currentStack.playback.reset(context.ms);
    }

    this.currentStack?.preRender(context);
  }
}

export class Mesh extends AnimatableInterface(MeshSceneNode) {
  preRender(context) {
    super.preRender(context);

    // descendents of Mesh will add vertex buffers that are needed to be
    // rendered every frame. So we need to clear it up when we are setting
    // up the render state.
    this.vertexBuffers = [];
  }

  getMaterialsState(context) {
    // because we want to read the settings from relative root for the
    // material, we override the getMaterials method
    const state = context.sceneManager.getNodeStateByID(this.relativeRoot.id);
    return {
      material: state.material,
      ambient: state.ambient,
    };
  }
}

export class Geometry extends SceneNode {
  constructor(options, vertexBuffer) {
    super({...options, type: "fbx-geometry"});
    this._skinningEnabled = true;
    this.vertexBuffer = vertexBuffer;
    this.skinDeformers = [];
  }

  get skinningEnabled() {
    return this._skinningEnabled && !!this.skinDeformers.length;
  }

  add(node) {
    super.add(node);
    if (node instanceof SkinDeformer) {
      this.skinDeformers.push(node);
    }
    return this;
  }

  preRender(context) {
    super.preRender(context);
    if (!this._boneMatrixTexture && this.skinningEnabled) {
      const {gl} = context;
      this._boneMatrixTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._boneMatrixTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
  }

  render() {
    let renderable = findParentByType(this, RenderableSceneNode);
    if (!renderable) {
      return;
    }

    renderable.addVertexBuffer(this.vertexBuffer);
    if (this.skinningEnabled) {
      let boneMatrices = [];

      // Skin deformers deform the mesh for the model we are processing.
      for (const skin of this.skinDeformers) {
        for (const cluster of skin.items) {
          boneMatrices[cluster.boneIndex] = cluster.worldMatrix.transpose().data;
        }
      }

      if (boneMatrices.length) {
        renderable.shaderProgram.addUniforms([
          {
            name: "boneMatrixTexture",
            update: (gl, {index}) => {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, this._boneMatrixTexture);
              gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA32F,
                4,
                boneMatrices.length,
                0,
                gl.RGBA,
                gl.FLOAT,
                // NOTE(miguel): we flip images with UNPACK_FLIP_Y_WEBGL so that
                // textures can render correctly. But that affects the order
                // of every texture, including the texture we are creating
                // with bone matrices. But all we have to do is reverse the
                // list of matrices, since the matrix increments along the
                // Y axis.  So reversing the list matrices basically flips
                // the texture on it Y axis.
                new Float32Array(boneMatrices.reverse().flat())
              );

              gl.uniform1i(index, this._boneMatrixTexture);
            },
          },
          {
            name: "enabledSkinAnimation",
            update: (gl, {index}) => {
              gl.uniform1i(index, 1);
            },
          },
        ]);
      }
    }
  }
}

export class Armature extends AnimatableInterface(RenderableSceneNode) {
  constructor(options) {
    super({...options, type: "fbx-armature"});
    // _bonesByID gets initialized when its getter is first accessed.
    this._bonesByID = null;
    this._renderEnabled = false;
    this.renderables = [];
  }

  get bonesByID() {
    if (!this._bonesByID) {
      this.registerBones();
    }
    return this._bonesByID;
  }

  get renderEnabled() {
    return this._renderEnabled && !!this.shaderProgram;
  }

  // registerBones will iterate thru the entire skeleton and will register
  // each bone in the armature so that skin clusters can find references
  // to the bone they are linked to.
  // You can call this yourself to initialize the skeleton. Otherwise this
  // happens automatically when bonesByID is called at runtime.
  registerBones() {
    this._bonesByID = null;
    const bones = findChildrenByType(this, Bone);
    if (bones.length) {
      this._bonesByID = {};
      for (const bone of bones) {
        this._bonesByID[bone.id] = bone;
      }
    }

    return this;
  }

  addRenderable(renderable) {
    this.renderables.push(renderable);
    return this;
  }

  preRender(context) {
    super.preRender(context);
    this.vertexBuffers = [];
    this.renderables = [];
  }

  render() {
    if (!this.renderEnabled) {
      return;
    }

    const shaderProgram = this.shaderProgram;
    const gl = shaderProgram.gl;
    const projectionMatrix = this.getProjectionMatrix();

    gl.disable(gl.DEPTH_TEST);

    // Configure shader program with its current state.
    shaderProgram.addUniforms([
      {
        name: "projectionMatrix",
        update: (gl, {index}) => {
          gl.uniformMatrix4fv(index, false, projectionMatrix.data);
        },
      },
    ]);

    this.renderables.forEach(({vertexBuffer, worldMatrix, primitiveType}) => {
      shaderProgram
        .addUniforms([
          {
            name: "worldMatrix",
            update: (gl, {index}) => {
              gl.uniformMatrix4fv(index, true, worldMatrix.data);
            },
          },
        ])
        .render(vertexBuffer, primitiveType);
    });

    gl.enable(gl.DEPTH_TEST);
  }
}

// NOTE: PreRotation is _not_ supported so you will run into rendering issues
// caused by incorrect matrix calculations when rendering a scene. To work
// around that for now you can re-export the FBX model in Blender which will
// convert PreRotation data into LcL Rotation data.
export class Bone extends AnimatableInterface(SceneNode) {
  constructor(options, id) {
    super({...options, type: "fbx-bone"});
    this.id = id;
  }

  render(context) {
    const armature = findParentByType(this, Armature);
    if (this.parent === armature || !armature.renderEnabled) {
      return;
    }

    // This is very raw copying of the position for the beginning and
    // ending og the bone so that we can render it in the correct
    // position.  This is not taking into account rotation of the bone
    // which is OK for now.
    // TODO(miguel): change this logic to create coordinates at the origin
    // where we can provide the bone matrix directly so that we can have
    // rotation and scale included when rendering a bone.
    const dataA = this.worldMatrix.data;
    const dataB = this.parent.worldMatrix.data;
    const a = [dataA[3], dataA[7], dataA[11]];
    const b = [dataB[3], dataB[7], dataB[11]];

    const {gl} = context;
    armature.addRenderable({
      vertexBuffer: new VertexBuffer({
        positions: new VertexBufferData(gl, [a[0], a[1], a[2], b[0], b[1], b[2]]),
        colors: new VertexBufferData(gl, [0.7, 1, 1, 1, 1, 1, 1, 1]),
      }),
      worldMatrix: mat4.Matrix4.identity(),
      primitiveType: gl.LINES,
    });
  }
}

export class SkinDeformer extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type: "fbx-skin-deformer"}));
  }
}

export class SkinDeformerCluster extends SceneNode {
  constructor(options, indexes, weights, transform, transformLink) {
    super(Object.assign({}, options, {type: "fbx-skin-deformer-cluster"}));
    this.boneIDs = [];
    this.indexes = indexes;
    this.weights = weights;
    this.transform = transform;

    // Link refers to the bone this cluster is linked to, and transformLink
    // is the pose matrix for that bone.
    this.transformLink = transformLink;
  }

  withBoneIndex(index) {
    this.boneIndex = index;
    return this;
  }

  add(node) {
    if (node instanceof Bone) {
      this.boneIDs.push(node.id);
    } else {
      super.add(node);
    }
    return this;
  }

  preRender(context) {
    super.preRender(context);

    const armatute = this.relativeRoot.items.find((x) => x instanceof Armature);

    // We are only taking the first bone because skin cluster only
    // have one bone associated with it in the fbx files I have looked
    // at. But if multiple bones affect a skin cluster has multiple
    // bones then we need to take their average.
    const bone = armatute.bonesByID[this.boneIDs[0]];
    this.withWorldMatrix(bone.worldMatrix.multiply(this.transform));
  }
}

export class AnimationStack extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type: "fbx-animation-stack"}));
    this.animationLayers = [];
    this.playback = new AnimationPlayback();
  }

  preRender(context) {
    // TOOD(miguel): fps comes from the FBX file. We should also make this
    // configurable in the UI
    const playback = this.playback;
    const animationNode = this.parent;
    const animationState = context.sceneManager.getNodeStateByID(animationNode.id);

    const stackName = animationState?.stackName;
    if (stackName && this.name !== stackName) {
      return;
    }

    if (animationState.state && playback.state !== animationState.state) {
      const {fps = 24} = animationState;

      switch (animationState.state) {
        case "paused":
          playback.pause(context.ms);
          break;
        case "play":
          playback.play(context.ms);
          break;
        case "prev":
          if (playback.state === "play") {
            playback.pause(context.ms);
          }

          context.sceneManager.updateNodeStateByID(animationNode.id, {
            ...animationState,
            state: playback.state,
          });

          playback.skip(-(1000 / fps));
          break;
        case "next":
          if (playback.state === "play") {
            playback.pause(context.ms);
          }

          context.sceneManager.updateNodeStateByID(animationNode.id, {
            ...animationState,
            state: playback.state,
          });

          playback.skip(1000 / fps);
          break;
      }
    }
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
    if (!(node instanceof AnimationCurveNode)) {
      // eslint-disable-next-line
      console.error("only AnimationCurveNode can be added as child nodes in AnimationLayer");
      return this;
    }

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
    return [this.pname, this.items.map((item) => item.getValue(ms, speed))];
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
    return [this.pname, this.animate(ms, speed)];
  }
}

const transformIndex = {"d|X": 0, "d|Y": 1, "d|Z": 2};
function getTransformAnimation(animation, defaultValues) {
  const transform = [...defaultValues];
  for (let i = 0; i < animation.length; i++) {
    transform[transformIndex[animation[i][0]]] = animation[i][1];
  }
  return transform;
}

function getAnimation(context, animatableNode) {
  // relative root is a skinned mesh node, which will have an animation
  // property in it for easy access to the animation node.
  const animation = animatableNode.relativeRoot.animation;
  const stack = animation?.currentStack;
  if (!stack) {
    return;
  }

  const animationState = context.sceneManager.getNodeStateByID(animation.id);
  const speed = animationState.speed == null ? 1 : animationState.speed;
  const ms = stack.playback.elapsed(context.ms);
  const curves = findCurveNodesInLayer(stack.animationLayers[0], animatableNode.animationNodes);

  const {translation, rotation, scale} = evaluateAnimation(ms, speed, curves);

  if (!translation && !rotation && !scale) {
    return;
  }

  return {
    translation,
    rotation,
    scale,
  };
}

function evaluateAnimation(ms, speed, curveNodes) {
  const result = {};
  const channels = {};
  const ktime = KTIME_ONE_SECOND * ms * 0.001;

  curveNodes.forEach((curveNode) => {
    const [pname, values] = curveNode.getValues(ktime, speed);
    channels[pname] = {
      values,
      defaults: curveNode.defaultValues,
    };
  });

  const translation = channels["Lcl Translation"];
  if (translation) {
    result["translation"] = getTransformAnimation(translation.values, translation.defaults);
  }

  const rotation = channels["Lcl Rotation"];
  if (rotation) {
    result["rotation"] = getTransformAnimation(rotation.values, rotation.defaults);
  }

  const scaling = channels["Lcl Scaling"];
  if (scaling) {
    result["scale"] = getTransformAnimation(scaling.values, scaling.defaults);
  }

  return result;
}

function findCurveNodesInLayer(layer, animationNodes) {
  return animationNodes.filter((n) => layer.animationCurveNodesByName[n.name]);
}
