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

export class ModelNode extends RenderableSceneNode {
  constructor(options, shaderProgram) {
    super(Object.assign({}, options, {type:"fbx-model"}));
    this.shaderProgram = shaderProgram.clone();
    this.vertexBuffers = [];
  }

  addVertexBuffer(vertexBuffer) {
    this.vertexBuffers = this.vertexBuffers.concat(vertexBuffer);
    return this;
  }

  preRender() {
    this.shaderProgram.setUniforms([]);
    this.vertexBuffers = [];
  }

  render(context) {
    const {shaderProgram, worldMatrix} = this;
    const {gl, projectionMatrix, sceneManager} = context;

    const lightsStates = findParentItemsWithItemType(this, "light")
      .map(({name}) => sceneManager.getNodeStateByName(name));

    const lightPositions = lightsStates
      .map(({transform: {position}}, idx) => ({
        name: `lightPosition${idx}`,
        update: ({index}) => {
          gl.uniform3fv(index, vec3.normalize(...position));
        },
      }));

    const lightColors = lightsStates
      .map(({light: {color}}, idx) => ({
        name: `lightColor${idx}`,
        update: ({index}) => {
          gl.uniform3fv(index, color);
        }
      }));

    const lightIntensities = lightsStates
      .map(({light: {intensity}}, idx) => ({
        name: `lightIntensity${idx}`,
        update: ({index}) => {
          gl.uniform1f(index, intensity);
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
        },
        ...lightPositions,
        ...lightColors,
        ...lightIntensities,
      ]);

    this.vertexBuffers.forEach(vb => {
      RenderableSceneNode.render(gl, program, vb);
    });
  }
}

export class GometryNode extends SceneNode {
  constructor(options, vertexBuffer) {
    super(Object.assign({}, options, {type:"fbx-geometry"}));
    this.vertexBuffer = vertexBuffer;
  }

  render(/*context*/) {
    let renderable = this.parent;
    while (!(renderable instanceof ModelNode)) {
      renderable = renderable.parent;
    }

    if (renderable) {
      renderable.addVertexBuffer(this.vertexBuffer);
    }
  }
}

export class MaterialNode extends SceneNode {
  constructor(options) {
    super(Object.assign({}, options, {type:"fbx-material"}));
    this.ambientColor = [1, 1, 1];
    this.materialColor = [1, 1, 1, 1];
    this.reflectionFactor = 1;
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
    let renderable = this.parent;
    while (!(renderable instanceof ModelNode)) {
      renderable = renderable.parent;
    }

    if (renderable) {
      const {gl} = context;

      renderable.shaderProgram.addUniforms([{
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

// The code in the TextureNode is basically all lifted from:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
export class TextureNode extends SceneNode {
  constructor(gl, fileName, textureID, options) {
    super(Object.assign({}, options, {type: "fbx-texture"}));

    this.textureID = textureID;
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

    const image = new Image();
    image.onload = () => {
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
    };

    image.src = "/resources/textures/" + fileName;
  }

  render(context) {
    let renderable = this.parent;
    while (!(renderable instanceof ModelNode)) {
      renderable = renderable.parent;
    }

    if (renderable) {
      const {gl} = context;
      const {textureID} = this;
      
      renderable.shaderProgram.addUniforms([
        {
          name: "uTexture" + textureID,
          update: ({index}) => {
            gl.activeTexture(gl.TEXTURE0 + textureID);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(index, textureID);
          },
        }, {
          name: "uTexture" + textureID + "Enabled",
          update: ({index}) => {
            gl.uniform1i(index, 1);
          },
        }
      ]);
    }
  }
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}