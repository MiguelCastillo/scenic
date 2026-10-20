import {mat4} from "@scenic/math";
import {VertexBuffer, VertexBufferData} from "@scenic/renderer";
import {
  keyframe as sceneAnimationKeyframe,
  playback as sceneAnimationPlayback,
} from "@scenic/animation";

import {
  Node as SceneNode,
  Mesh as MeshSceneNode,
  Renderable as RenderableSceneNode,
  RenderOrder,
  Animation as AnimationSceneNode,
  Geometry as GeometrySceneNode,
  Texture as TextureSceneNode,
  Material as MaterialSceneNode,
} from "@scenic/scene";

import {shaderRegistry} from "../../shader-registry.js";

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
      maybeUpdatePlayback(context, this.relativeRoot.animation);

      const animationTransform = getAnimationTransform(context, this);
      if (!animationTransform) {
        super.preRender(context);
        return;
      }

      const {transform} = context.sceneManager.getNodeStateByID(this.id);

      const {
        translation = transform.position,
        rotation = transform.rotation,
        scale = transform.scale,
      } = animationTransform;

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

  _configureCurrentStack(context) {
    const animationState = context.sceneManager.getNodeStateByID(this.id);
    const stackName = animationState?.stackName;

    if (!stackName) {
      this.currentStack = this.stacks[0];
    } else if (this.currentStack?.name !== stackName) {
      this.currentStack = this.stacks.find((stack) => stack.name === stackName);
      this.currentStack.playback.reset(context.ms);
    }
  }

  preRender(context) {
    this._configureCurrentStack(context);
    this.currentStack?.preRender(context);
  }
}

export class Mesh extends AnimatableInterface(MeshSceneNode) {
  // isBoundingVolumeInView is always true for a mesh with skinned geometry,
  // whose bones move its vertices away from its bounding volume.
  isBoundingVolumeInView(worldMatrix) {
    if (this.items.some((child) => child.skinningEnabled)) {
      return true;
    }
    return super.isBoundingVolumeInView(worldMatrix);
  }

  // setUniforms sets the uniforms of program, which must be in use, whose
  // values the mesh has: a mesh's (see setUniforms in Mesh in
  // @scenic/scene), and those of the nodes under it that only fbx models
  // have: its skinned Geometry's bones, and its Material's textures.
  //
  // It is part of render: only a renderable's render calls it, after use(),
  // itself or through another setUniforms, with render's context; anywhere
  // else its values go missing (see "Where setUniforms is called" in
  // drawing.md, at the top of the repo).
  setUniforms(program, context) {
    super.setUniforms(program, context);
    for (let i = 0; i < this.items.length; i++) {
      const child = this.items[i];
      if (child instanceof Geometry) {
        child.setUniforms(program, context);
      } else if (child instanceof MaterialSceneNode) {
        for (let j = 0; j < child.items.length; j++) {
          if (child.items[j] instanceof TextureSceneNode) {
            child.items[j].setUniforms(program, context);
          }
        }
      }
    }
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

export class Geometry extends GeometrySceneNode {
  constructor(options, vertexBuffer) {
    super({...options, type: "fbx-geometry"}, vertexBuffer);
    this._skinningEnabled = true;
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

  dispose(gl) {
    if (this._boneMatrixTexture) {
      gl.deleteTexture(this._boneMatrixTexture);
      this._boneMatrixTexture = null;
    }

    super.dispose(gl);
  }

  // prepareForView works out the bones' matrices for this frame, as the
  // data of a texture, one row of 4 RGBA pixels for each bone's matrix, for
  // setUniforms to upload as its mesh draws. The texture is made the
  // first time.
  prepareForView(context) {
    // The parent renderable has no shader program until the shader registry
    // gives it one, which can be a few frames after the model is built, and
    // then there is nothing to draw yet.
    const renderable = SceneNode.findParentByType(this, RenderableSceneNode);
    this._boneMatrixData = null;
    if (!renderable?.shaderProgram || !this.skinningEnabled) {
      return;
    }

    if (!this._boneMatrixTexture) {
      const {gl} = context;
      this._boneMatrixTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._boneMatrixTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    const boneMatrices = [];

    // Skin deformers deform the mesh for the model we are processing.
    for (const skin of this.skinDeformers) {
      for (const cluster of skin.items) {
        boneMatrices[cluster.boneIndex] = cluster.worldMatrix.transpose().data;
      }
    }

    if (boneMatrices.length) {
      // NOTE(miguel): we flip images with UNPACK_FLIP_Y_WEBGL so that
      // textures can render correctly. But that affects the order of every
      // texture, including the texture we are creating with bone matrices.
      // But all we have to do is reverse the list of matrices, since the
      // matrix increments along the Y axis. So reversing the list matrices
      // basically flips the texture on it Y axis.
      this._boneMatrixData = new Float32Array(boneMatrices.reverse().flat());
      this._boneCount = boneMatrices.length;
    }
  }

  // setUniforms uploads this frame's bone matrices to their texture, on
  // texture unit 0, and sets the uniforms of program, its renderable's
  // program, which must be in use, that turn skinning on and read the
  // texture. Its mesh calls it as it draws (see setUniforms in Mesh).
  //
  // It is part of render: only a renderable's render calls it, after use(),
  // itself or through another setUniforms, with render's context; anywhere
  // else its values go missing (see "Where setUniforms is called" in
  // drawing.md, at the top of the repo).
  setUniforms(program, context) {
    if (!this._boneMatrixData) {
      return;
    }
    const {gl} = context;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._boneMatrixTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      4,
      this._boneCount,
      0,
      gl.RGBA,
      gl.FLOAT,
      this._boneMatrixData
    );
    program.uniform("boneMatrixTexture").set1i(0);
    program.uniform("enabledSkinAnimation").set1i(true);
  }
}

export class Armature extends AnimatableInterface(RenderableSceneNode) {
  constructor(options) {
    super({...options, type: "fbx-armature"});
    // _bonesByID gets initialized when its getter is first accessed.
    this._bonesByID = null;
    this._renderEnabled = false;
    this.renderables = [];
    // The skeleton is drawn over everything, so that it can be seen inside
    // its model.
    this.renderOrder = RenderOrder.OVERLAY;
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
    const bones = SceneNode.findChildrenByType(this, Bone);
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

  // prepareForView empties renderables, before its bones add to it in their
  // own prepareForView, and adds the armature to its viewport's
  // renderablesInView when its skeleton is shown.
  prepareForView() {
    this.renderables = [];
    if (this.renderEnabled) {
      this.getViewport()?.renderablesInView.push(this);
    }
  }

  // render draws each bone of the skeleton, with its viewport's uniforms,
  // and each bone's world matrix before drawing the bone.
  render(context) {
    const {gl} = context;
    const program = this.shaderProgram.use();
    this.getViewport().setUniforms(program, context);

    gl.disable(gl.DEPTH_TEST);
    const worldMatrix = program.uniform("worldMatrix");
    for (let i = 0; i < this.renderables.length; i++) {
      const {vertexBuffer, worldMatrix: boneWorldMatrix, primitiveType} = this.renderables[i];
      worldMatrix.setMatrix4fv(true, boneWorldMatrix.data);
      program.draw(vertexBuffer, primitiveType);
    }
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

  // prepareForView adds a line from the bone to its parent to its
  // armature's renderables, for the armature to draw.
  prepareForView(context) {
    const armature = SceneNode.findParentByType(this, Armature);
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
    const positions = [a[0], a[1], a[2], b[0], b[1], b[2]];

    // The bone moves every frame, so the line's buffers are created once and
    // its positions are updated in place rather than allocating new buffers
    // on every frame.
    if (!this._lineVertexBuffer) {
      this._lineVertexBuffer = new VertexBuffer({
        positions: new VertexBufferData(gl, positions),
        colors: new VertexBufferData(gl, [0.7, 1, 1, 1, 1, 1, 1, 1]),
      });
    } else {
      this._lineVertexBuffer.positions.update(positions);
    }

    armature.addRenderable({
      vertexBuffer: this._lineVertexBuffer,
      worldMatrix: mat4.Matrix4.identity(),
      primitiveType: gl.LINES,
    });
  }

  dispose(gl) {
    if (this._lineVertexBuffer) {
      this._lineVertexBuffer.dispose();
      this._lineVertexBuffer = null;
    }

    super.dispose(gl);
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
    this.playback = new sceneAnimationPlayback.Playback();
  }

  add(node) {
    this.animationLayers.push(node);

    if (this.playback.duration && node.duration !== this.playback.duration) {
      // eslint-disable-next-line
      console.warn(
        `animation playback duration has different values. current ${this.playback.duratin}. new ${node.duration}`
      );
    }

    this.playback.setDuration(node.duration);
    return this;
  }
}

export class AnimationLayer extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type: "fbx-animation-layer"}));
    this.animationCurveNodesByName = {};
    this.animationCurveNodes = [];
  }

  get duration() {
    return this.animationCurveNodes[0]?.items[0]?.animation.duration;
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

  getValues(ms) {
    return [this.pname, this.items.map((item) => item.getValue(ms))];
  }
}

export class AnimationCurve extends SceneNode {
  constructor(times, values, pname, options) {
    super(Object.assign({}, options, {type: "fbx-animation-curve"}));
    this.times = times;
    this.values = values;
    this.pname = pname;
    this.animation = new sceneAnimationKeyframe.AnimateScalar(values, times);
  }

  getValue(ms) {
    return [this.pname, this.animation.animate(ms)];
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

function getAnimationTransform(context, animatableNode) {
  // relative root is a skinned mesh node, which will have an animation
  // property in it for easy access to the animation node.
  const animation = animatableNode.relativeRoot.animation;
  const stack = animation?.currentStack;
  if (!stack) {
    return;
  }

  const curves = findCurveNodesInLayer(stack.animationLayers[0], animatableNode.animationNodes);
  const playback = stack.playback;

  const {translation, rotation, scale} = evaluateAnimation(playback.elapsed(context.ms), curves);

  if (!translation && !rotation && !scale) {
    return;
  }

  return {
    translation,
    rotation,
    scale,
  };
}

function evaluateAnimation(ms, curveNodes) {
  if (!curveNodes.length) {
    return {};
  }

  const result = {};
  const channels = {};

  curveNodes.forEach((curveNode) => {
    const [pname, values] = curveNode.getValues(ms);
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

const MIN_ANIMATION_SPEED = 0.001;

function maybeUpdatePlayback(context, animationNode) {
  const stack = animationNode?.currentStack;
  if (!stack) {
    return;
  }

  const animationState = context.sceneManager.getNodeStateByID(animationNode.id);
  const playback = stack.playback;
  const ms = context.ms;

  if (animationState.state && playback.state !== animationState.state) {
    const {fps = 24} = animationState;

    switch (animationState.state) {
      case "paused":
        playback.pause(ms);
        break;
      case "play":
        playback.play(ms);
        break;
      case "prev":
        if (playback.state === "play") {
          playback.pause(ms);
        }

        context.sceneManager.updateNodeStateByID(animationNode.id, {
          ...animationState,
          state: playback.state,
        });

        playback.skip(-(1000 / fps));
        break;
      case "next":
        if (playback.state === "play") {
          playback.pause(ms);
        }

        context.sceneManager.updateNodeStateByID(animationNode.id, {
          ...animationState,
          state: playback.state,
        });

        playback.skip(1000 / fps);
        break;
    }
  }

  playback.updateSpeed(ms, animationState.speed === 0 ? MIN_ANIMATION_SPEED : animationState.speed);
}

// An FBX mesh draws with the textured shader when it has any textures. The
// shaders are separate because a shader with a sampler2D that is never used
// makes WebGL warn "there is no texture bound to the unit 0".
shaderRegistry.register(Mesh, (mesh) =>
  SceneNode.findChildByType(mesh, TextureSceneNode)
    ? "shaders/phong-texture"
    : "shaders/phong-lighting"
);

// An armature draws its bones as lines, unlit.
shaderRegistry.register(Armature, "shaders/flat-material");
