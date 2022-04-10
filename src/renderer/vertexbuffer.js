class VertexBufferArray {
  constructor(gl, data, bufferType=gl.ARRAY_BUFFER) {
    this.gl = gl;

    // Create a new buffer object
    this.data = data;
    this.buffer = gl.createBuffer();
    this.bufferType = bufferType;
    gl.bindBuffer(bufferType, this.buffer);
    gl.bufferData(bufferType, this.data, gl.STATIC_DRAW);
  }

  bind() {
    const {
      gl,
      buffer,
      bufferType,
    } = this;

    gl.bindBuffer(bufferType, buffer);
  }
}

// VertexBufferData is largely for vertex positions and normals, which are
// float32 data points. Because we are dealing with triangles in 3 dimensions,
// we are defaulting to 3 components (X,Y,Z) per vertex.
export class VertexBufferData extends VertexBufferArray {
  constructor(gl, data, componentsPerVertex=3, bufferType=gl.ARRAY_BUFFER) {
    super(gl, new Float32Array(data), bufferType);

    // This is only useful when we are rendering vertices directly without
    // indexes since we need to tell the vertex shader how many items in the
    // vertex buffer make up the primitive we are drawing. Most often we will
    // be rendering triangles, so componentsPerVertex defaults to 3 since a
    // triangle has 3 vertices.
    this.componentsPerVertex = componentsPerVertex;
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

// VertexBuffer contains the buffers that are most commonly used for rendering.
// It makes it simpler to find all the relevant buffers in one place with a
// render function that can use either vertices of indexes.
// If an index buffer exists, then we render with the indexes using
// gl.drawElements. Otherwise, we will render the positions with gl.drawArrays.
export class VertexBuffer {
  constructor(options={}) {
    [
      "indexes",
      "positions",
      "colors",
      "normals",
      "textureCoords",
      "tangents",
      "bitangents",
      "weights",
      "boneids",
    ]
    .filter(component => options[component])
    .forEach(component => {
      this[component] = options[component];
    });
  }

  withPositions(positions) {
    this.positions = positions;
    return this;
  }

  withColors(colors) {
    this.colors = colors;
    return this;
  }

  withNormals(normals) {
    this.normals = normals;
    return this;
  }

  withTextureCoords(textureCoords) {
    this.textureCoords = textureCoords;
    return this;
  }

  withIndexes(indexes) {
    this.indexes = indexes;
    return this;
  }

  withWeights(weights) {
    this.weights = weights;
    return this;
  }

  withBoneIDs(boneids) {
    this.boneids = boneids;
    return;
  }

  clone() {
    return new VertexBuffer(this);
  }

  static create(options) {
    return new VertexBuffer(options);
  }
}
