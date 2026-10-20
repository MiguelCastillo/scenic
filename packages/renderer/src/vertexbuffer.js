// vertexAttributes are the vertex attributes a shader can read, the same in
// every shader program: each as {name, vertexBufferName, location, size},
// its name in the shader, such as `position`, the name of the VertexBuffer
// field that holds its data, such as `positions`, its location, and how
// many numbers it has per vertex.
//
// Every program binds its attributes to these locations before it is
// linked (see linkShaderProgram), so that a VertexBuffer's vertex array,
// recorded once with them, works with any program (see VertexBuffer).
export const vertexAttributes = [
  {name: "position", vertexBufferName: "positions", location: 0, size: 3},
  {name: "normal", vertexBufferName: "normals", location: 1, size: 3},
  {name: "color", vertexBufferName: "colors", location: 2, size: 3},
  {name: "textureCoord", vertexBufferName: "textureCoords", location: 3, size: 2},
  {name: "tangent", vertexBufferName: "tangents", location: 4, size: 3},
  {name: "bitangent", vertexBufferName: "bitangents", location: 5, size: 3},
  {name: "weight", vertexBufferName: "weights", location: 6, size: 4},
  {name: "boneid", vertexBufferName: "boneids", location: 7, size: 4},
];

class VertexBufferArray {
  constructor(gl, data, bufferType = gl.ARRAY_BUFFER) {
    this.gl = gl;

    // Create a new buffer object
    this.data = data;
    this.buffer = gl.createBuffer();
    this.bufferType = bufferType;
    // Without unbinding the vertex array first, a geometry drawn earlier
    // would draw with these indexes from then on: its triangles scrambled,
    // or missing. WebGL keeps which index buffer is bound as part of the
    // vertex array that is bound, and after a draw, the vertex array of the
    // geometry drawn last is still bound. So a terrain tile built after a
    // tree is drawn would give the tree the tile's indexes.
    if (bufferType === gl.ELEMENT_ARRAY_BUFFER) {
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(bufferType, this.buffer);
    gl.bufferData(bufferType, this.data, gl.STATIC_DRAW);
  }

  bind() {
    const {gl, buffer, bufferType} = this;

    gl.bindBuffer(bufferType, buffer);
  }

  dispose() {
    this.gl.deleteBuffer(this.buffer);
  }
}

// VertexBufferData is largely for vertex positions and normals, which are
// float32 data points. Because we are dealing with triangles in 3 dimensions,
// we are defaulting to 3 components (X,Y,Z) per vertex.
export class VertexBufferData extends VertexBufferArray {
  constructor(gl, data, componentsPerVertex = 3, bufferType = gl.ARRAY_BUFFER) {
    super(gl, new Float32Array(data), bufferType);

    // This is only useful when we are rendering vertices directly without
    // indexes since we need to tell the vertex shader how many items in the
    // vertex buffer make up the primitive we are drawing. Most often we will
    // be rendering triangles, so componentsPerVertex defaults to 3 since a
    // triangle has 3 vertices.
    this.componentsPerVertex = componentsPerVertex;
  }

  // update replaces the buffer contents in place, which is cheaper than
  // creating a new buffer for data that changes every frame.
  update(data) {
    const {gl, buffer, bufferType} = this;

    this.data = new Float32Array(data);
    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, this.data, gl.STATIC_DRAW);
  }
}

// VertexBufferIndexes are indexes for rendering triangles based on indexes.
export class VertexBufferIndexes extends VertexBufferArray {
  constructor(gl, data) {
    super(gl, new Uint32Array(data), gl.ELEMENT_ARRAY_BUFFER);
  }
}

// TextureVertexBufferData is for texture coordinates, which is just UV
// coordinates. These coordinates are stored in a 32 bit float array.
export class TextureVertexBufferData extends VertexBufferArray {
  constructor(gl, data) {
    super(gl, new Float32Array(data));
  }
}

// The buffers a VertexBuffer can have: its indexes, and one for each vertex
// attribute.
const vertexBufferComponents = [
  "indexes",
  ...vertexAttributes.map(({vertexBufferName}) => vertexBufferName),
];

// VertexBuffer holds a geometry's buffers, one for each vertex attribute it
// has, such as positions and normals, and its indexes, and its vertex array:
// a WebGL object that records which buffer each attribute reads, so that
// drawing the geometry binds it with one call (see draw in ShaderProgram).
//
// The vertex array is recorded once, when the VertexBuffer is made with its
// buffers, and again only when buffers are added to it (see addBuffers), so
// that it is set up while geometry is built, never while drawing. All its buffers must be of one
// WebGL context.
//
// A vertex array reading a buffer that has been deleted makes every draw
// with it fail, with INVALID_OPERATION, so the vertex array is deleted with
// the buffers (see dispose), or before them, when they are shared (see
// disposeVertexArray). See "Vertex arrays" in drawing.md, at the top of the
// repo, for how they work and the rules that keep them working.
export class VertexBuffer {
  constructor(options = {}) {
    vertexBufferComponents.forEach((component) => {
      this[component] = options[component];
    });
    // The vertex array, made once, and recorded now and when buffers are
    // added (see addBuffers). It is null for a VertexBuffer whose buffers
    // aren't WebGL buffers, such as a test's, which is never drawn.
    const gl = this._findGL();
    this.vertexArray = gl ? gl.createVertexArray() : null;
    this._recordVertexArray();
  }

  // dispose deletes the vertex array and the buffers of every component.
  dispose() {
    this.disposeVertexArray();
    vertexBufferComponents.forEach((component) => {
      if (this[component]) {
        this[component].dispose();
      }
    });
  }

  // disposeVertexArray deletes only the vertex array, for a VertexBuffer
  // whose buffers are deleted by whoever shares them, such as the terrain's
  // tiles' index buffers.
  disposeVertexArray() {
    if (this.vertexArray) {
      this._findGL().deleteVertexArray(this.vertexArray);
      this.vertexArray = null;
    }
  }

  // _recordVertexArray records, in the vertex array, which buffer each
  // vertex attribute reads, at its location (see vertexAttributes), and the
  // index buffer. It leaves no vertex array bound, so that nothing else
  // changes this one.
  _recordVertexArray() {
    if (!this.vertexArray) {
      return;
    }
    const gl = this._findGL();
    gl.bindVertexArray(this.vertexArray);
    for (const {vertexBufferName, location, size} of vertexAttributes) {
      const buffer = this[vertexBufferName];
      if (buffer) {
        buffer.bind();
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }
    }
    if (this.indexes) {
      this.indexes.bind();
    }
    gl.bindVertexArray(null);
  }

  // _findGL finds the WebGL context of the VertexBuffer's buffers, or null
  // when it has none yet.
  _findGL() {
    for (const component of vertexBufferComponents) {
      if (this[component]) {
        return this[component].gl;
      }
    }
    return null;
  }

  // addBuffers adds buffers to the VertexBuffer, such as {weights,
  // boneids}, and records its vertex array again, once, with them. It is for
  // buffers that can only be made after the geometry is built and in use,
  // such as an fbx model's bone weights, which come from its skin, found
  // once the whole model is built. Everything else is passed to the
  // constructor.
  addBuffers(buffers) {
    Object.assign(this, buffers);
    this._recordVertexArray();
    return this;
  }
}
