class VertexBufferArray {
  constructor(gl, data, componentsPerVertex, bufferType) {
    this.gl = gl;

    // This is only useful when we are rendering vertices directly without
    // indexes since we need to tell the vertex shader how many items in the
    // vertex buffer make up the primitive we are drawing. Most often we will
    // be rendering triangles, so componentsPerVertex defaults to 3 since a
    // triable has 3 vertices.
    this.componentsPerVertex = componentsPerVertex;

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
    super(gl, new Float32Array(data), componentsPerVertex, bufferType);
  }

  render(gl, primitiveType) {
    const {
      data,
      componentsPerVertex,
    } = this;

    const vertexOffset = 0;

    this.bind();

    gl.drawArrays(
      primitiveType,
      vertexOffset,
      data.length/componentsPerVertex);
  }
}

// VertexBufferIndexes these indexes are for rendering triangles, so we are
// going to use 3 components (X,Y,Z) per vertex in 3 dimensional space.
export class VertexBufferIndexes extends VertexBufferArray {
  constructor(gl, data) {
    // Indexes are Unsigned Integers of 16 bits to match gl.UNSIGNED_SHORT
    // in the render method. And unsigned shorts give us a range of
    // 0 to 65,535.
    super(gl, new Uint16Array(data), 3, gl.ELEMENT_ARRAY_BUFFER);
  }

  render(gl, primitiveType) {
    const {data} = this;
    const vertexOffset = 0;

    this.bind();

    gl.drawElements(
      primitiveType,
      data.length,
      gl.UNSIGNED_SHORT,
      vertexOffset);
  }
}

export class VertexBuffer {
  constructor(options={}) {
    const {
      indexes=null,
      positions=null,
      colors=null,
      normals=null,
    } = options;

    if (indexes) {
      this.indexes = indexes;
    }

    if (positions) {
      this.positions = positions;
    }

    if (normals) {
      this.normals = normals;
    }

    if (colors) {
      this.colors = colors;
    }
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

  withIndexes(indexes) {
    this.indexes = indexes;
    return this;
  }

  clone() {
    return new VertexBuffer(this);
  }

  render(gl, primitiveType) {
    const {
      positions,
      indexes,
    } = this;

    // Send command to start rendering the vertices.
    if (indexes) {
      indexes.render(gl, primitiveType);
    }
    else {
      positions.render(gl, primitiveType);
    }

    return this;
  }

  static create(options) {
    return new VertexBuffer(options);
  }
}

