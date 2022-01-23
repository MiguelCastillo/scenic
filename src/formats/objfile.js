// https://www.fileformat.info/format/wavefrontobj/egff.htm
// https://en.wikipedia.org/wiki/Wavefront_.obj_file
// Some sample files https://people.sc.fsu.edu/~jburkardt/data/obj/obj.html
//
// Information about negative face indexes:
// http://paulbourke.net/dataformats/obj/
//
// WebGL is CCW be default!
// https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/frontFace
//

import {getIndexed3DComponents} from "../math/geometry.js";

const DEFAULT_GROUP_NAME = "__default_group_" + Math.floor(Math.random() * Math.floor(10000));
const COMMENT = "#";
const GROUP = "g";
const GEOMETRY_VERTEX = "v";
const NORMAL_VECTOR = "vn";
const TEXTURE_VERTEX = "vt";
const FACES = "f";
const UNKNOWN = "unknown";

export class ObjFile {
  constructor(data) {
    Object.assign(this, data);
  }

  static create(data, invertDirection) {
    return new ObjFile(parse(data, invertDirection));
  }

  getTriangles() {
    let obj = {
      vertices: [], normals: [], colors: [], textures: [],
    };

    return this.groups.reduce((result, group) => {
      if (group.vertices.length) {
        obj.vertices = obj.vertices.concat(group.vertices);
      }
      if (group.normals.length) {
        obj.normals = obj.normals.concat(group.normals);
      }
      if (group.textures.length) {
        obj.textures = obj.textures.concat(group.textures);
      }
      if (group.colors.length) {
        obj.colors = obj.colors.concat(group.colors);
      }

      const {faces} = group;
      const v = getIndexed3DComponents(obj.vertices, faces.vertices);
      const vc = getIndexed3DComponents(obj.colors, faces.vertices);
      const vn = getIndexed3DComponents(obj.normals, faces.normals);
      const vt = getIndexed3DComponents(obj.textures, faces.textures);

      return {
        vertices: result.vertices.concat(v),
        normals: result.normals.concat(vn),
        textures: result.textures.concat(vt),
        colors: result.colors.concat(vc),
      };
    }, {
      vertices: [],
      normals: [],
      textures: [],
      colors: [],
    });
  }

  getTriangleVertices() {
    let objVerts = [];

    return this.groups.reduce((result, group) => {
      if (group.vertices.length) {
        objVerts = objVerts.concat(group.vertices);
      }

      if (!objVerts.length) {
        return result;
      }

      return result.concat(getIndexed3DComponents(objVerts, group.faces.vertices));
    }, []);
  }

  getTriangleNormals() {
    let objVerts = [];

    return this.groups.reduce((result, group) => {
      if (group.normals.length) {
        objVerts = objVerts.concat(group.normals);
      }

      if (!objVerts.length) {
        return result;
      }

      return result.concat(getIndexed3DComponents(objVerts, group.faces.normals));
    }, []);
  }

  getTriangleColors() {
    let objVerts = [];

    return this.groups.reduce((result, group) => {
      if (group.colors.length) {
        objVerts = objVerts.concat(group.colors);
      }

      if (!objVerts.length) {
        return result;
      }

      return result.concat(getIndexed3DComponents(objVerts, group.faces.vertices));
    }, []);
  }

  static getIndexed3DComponents(vertices, indexes) {
    return getIndexed3DComponents(vertices, indexes);
  }
}

export function parse(data) {
  let currentGroup = createGroup(DEFAULT_GROUP_NAME);
  const groups = [currentGroup];

  function createGroup(name) {
    return {
      name,
      vertices: [],
      textures: [],
      normals: [],
      colors: [],
      faces: {
        vertices: [],
        textures: [],
        normals: [],
      }
    };
  }

  function processToken(token) {
    switch(token.type) {
      case COMMENT:
        break;
      case GROUP:
        // If the current group is empty and it is the default group, then we
        // just remove it.  We create a default group for handling obj files
        // that do not define a group before defining the first vertices.
        // But if an obj file does define a group in the very beginning of the
        // file, thn we delete the default group in favor of the one explicitly
        // defined in the obj file.
        if (currentGroup.name === DEFAULT_GROUP_NAME && isGroupEmpty(currentGroup)) {
          groups.pop();
        }

        currentGroup = createGroup(token.value.substring(GROUP.length).trim());
        groups.push(currentGroup);
        break;
      case GEOMETRY_VERTEX:
        const [v1, v2, v3, ...rgb] = parseVertices(token.value);
        currentGroup.vertices.push(v1, v2, v3);

        // It is possible to define x,y,x vertices followed by three more
        // values for r,g,b color values in the 0 to 1 range..
        if (rgb.length === 3) {
          currentGroup.colors.push(rgb[0], rgb[1], rgb[2]);
        }
        break;
      case NORMAL_VECTOR:
        currentGroup.normals.push(...parseVertices(token.value));
        break;
      case TEXTURE_VERTEX:
        currentGroup.textures.push(...parseVertices(token.value));
        break;
      case FACES:
        const {vertices, textures, normals} = parseFace(token.value);

        if (vertices.length) {
          currentGroup.faces.vertices.push(...vertices);
        }
        if (textures.length) {
          currentGroup.faces.textures.push(...textures);
        }
        if (normals.length) {
          currentGroup.faces.normals.push(...normals);
        }
        break;
      case UNKNOWN:
        //console.warn("Unknonwn token", token.value);
        break;
    }
  }

  for (let start = 0, end = 0; start != data.length; start = end + 1) {
    // We don't need leading new lines... Let's skip them.
    while (data[start] === "\n") {
      start++;
    }

    end = data.indexOf("\n", start);
    const line = data.substring(start, end);
    processToken(getToken(line));
  }

  return {
    groups
  };
}

function parseVertices(line) {
  const [, items] = line.match(/^(?:\w+\s+)?([^#]+)/);
  return items.split(/\s+/).map(parseFloat);
}

function parseFace(line) {
  const [, items] = line.match(/^(?:\w+\s+)?([^#]+)/);

  const faces = items
    .split(/\s+/)
    .reduce((result, f) => {
      // The format for a face is:
      // vertex_index/texture_index/normal_index
      //
      // And a face can have 3 or more components. Here we handle any
      // combination of the formats:
      // 1/2/3 => indexes for vertex, texture, normal.
      // 1//3  => indexes for vertex and normal.
      // 1     => index for vertex.
      //
      // When there are slashes with no values as in `1//2` then split will
      // generate three string value, one of which is an empty string.
      // When there is only one vertex value as in `1` then split will
      // generate one string value for v and undefined for t and n.
      const [v, t, n] = f.split("/");

      // Indexes in the file are all 1 index based... So we convert them all
      // to 0 index based since that's how arrays in JavaScript are indexed.
      // And since all the indexes start from 1, we will use that to our
      // advantage and do a simple coersion to to bool to determine if we
      // have an actual _face_ value we need to store.
      if (!!v) {
        result.vertices.push(+v -1);
      }
      if (!!t) {
        result.textures.push(+t -1);
      }
      if (!!n) {
        result.normals.push(+n -1);
      }

      return result;
    }, {
      normals: [],
      vertices: [],
      textures: [],
    });

  return triangulateFaces(faces);
}

function getToken(line) {
  if (isVertex(line)) {
    if (isGeometryVertex(line)) {
      return {
        type: GEOMETRY_VERTEX,
        value: line,
      };
    } else if (isNormalVector(line)) {
      return {
        type: NORMAL_VECTOR,
        value: line,
      };
    } else if (isTextureVertex(line)) {
      return {
        type: TEXTURE_VERTEX,
        value: line,
      };
    }
  } else if (isFace(line)) {
    return {
      type: FACES,
      value: line,
    };
  } else if (isComment(line)) {
    return {
      type: COMMENT,
      value: line,
    };
  } else if (isGroup(line)) {
    return {
      type: GROUP,
      value: line,
    };
  }

  return {
    type: UNKNOWN,
    value: line,
  };
}

function isComment(line) {
  return line[0] === "#";
}

function isGroup(line) {
  return line[0] === "g";
}

function isVertex(line) {
  return line[0] === "v";
}

function isGeometryVertex(line) {
  return line[0] === "v" && line[1] === " ";
}

function isNormalVector(line) {
  return line[0] === "v" && line[1] === "n";
}

function isTextureVertex(line) {
  return line[0] === "v" && line[1] === "t";
}

function isFace(line) {
  return line[0] === "f";
}

function isGroupEmpty(group) {
  const {
    vertices, normals, textures, colors, faces
  } = group;

  const {
    vertices: vertexIndexes,
    normals: normalIndexes,
    textures: textureIndexes,
  } = faces;

  return !(
    vertices.length || normals.length || textures.length || colors.length ||
    vertexIndexes.length || normalIndexes.length || textureIndexes.length
  );
}

// Obj files support a few different ways to define indexes for vertices to
// generate geometry.
//
// 1. The simplest and most straight forward one is a face with three
//    components. In this case the three components are for triangles.
//
// 2. Faces can have 4 components, in which case a face defines a
//    quadrilateral. We expand the 4 component face into a 6 component face
//    for two two triangles; webgl only really supports triangles.
//    Consider a face like:
//    f 1 2 3 4
//    We convert that to:
//    f 1 2 3
//    f 4 1 3
//
// 3. More than 4 components in a face. In this case, we need to expand the
//    list of components to generate tripplets of components for triangles.
//    Consder a face like:
//    f 1 2 3 4 5 6
//    We convert that to:
//    f 1 2 3
//    f 1 3 4
//    f 1 4 5
//    f 1 5 6
//
function triangulateFaces(faces) {
  let vertices = [];
  let normals = [];
  let textures = [];

  if (faces.vertices.length === 3) {
    return faces;
  }
  if (faces.vertices.length === 4) {
    vertices = vertices.concat(...faces.vertices, faces.vertices[0], faces.vertices[2]);

    if (faces.normals.length) {
      normals = normals.concat(...faces.normals, faces.normals[0], faces.normals[2]);
    }

    if (faces.textures.length) {
      textures = textures.concat(...faces.textures, faces.textures[0], faces.textures[2]);
    }
  }
  else if (faces.vertices.length > 4) {
    vertices = expandFaceIndexes(faces.vertices);
    normals = expandFaceIndexes(faces.normals);
    textures = expandFaceIndexes(faces.textures);
  }

  return {
    vertices, normals, textures,
  };
}

// Obj files can have more than 4 indexes in a single face definition. This
// routine will go through each of those face indexes and expand them out into
// separate indexes for triangles.
// This behavior was redacted from:
// https://github.com/frenchtoast747/webgl-obj-loader/blob/master/src/mesh.ts
function expandFaceIndexes(faceIndexes) {
  const newFaceIndexes = [];
  for (let i = 1; i < faceIndexes.length - 1; i++) {
    newFaceIndexes.push(faceIndexes[0], faceIndexes[i], faceIndexes[i + 1]);
  }
  return newFaceIndexes;
}
