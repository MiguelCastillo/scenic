import fs from "fs";
import path from "path";
import {ObjFile} from "./objfile.js";

const simpleCube = `
# cube.obj
#

g simple cube with _only_ vertices

v  0.0  0.0  0.0
v  0.0  0.0  1.0
v  0.0  1.0  0.0
v  0.0  1.0  1.0
v  1.0  0.0  0.0
v  1.0  0.0  1.0
v  1.0  1.0  0.0
v  1.0  1.0  1.0

f  1  7  5
f  1  3  7
f  1  4  3
f  1  2  4
f  3  8  7
f  3  4  8
f  5  7  8
f  5  8  6
f  1  5  6
f  1  6  2
f  2  6  8
f  2  8  4
`;

test("parse cube with _only_ vertices", () => {
  const cube = ObjFile.create(simpleCube);

  expect(cube.groups.length).toEqual(1);

  expect(cube.groups[0].name).toEqual("simple cube with _only_ vertices");
  expect(cube.groups[0].normals.length).toEqual(0);
  expect(cube.groups[0].faces.normals.length).toEqual(0);
  expect(cube.groups[0].textures.length).toEqual(0);
  expect(cube.groups[0].faces.textures.length).toEqual(0);

  // prettier-ignore
  expect(cube.groups[0].vertices).toEqual([
    0.0, 0.0, 0.0, // 0,
    0.0, 0.0, 1.0, // 1,
    0.0, 1.0, 0.0, // 2,
    0.0, 1.0, 1.0, // 3,
    1.0, 0.0, 0.0, // 4,
    1.0, 0.0, 1.0, // 5,
    1.0, 1.0, 0.0, // 6,
    1.0, 1.0, 1.0, // 7,
  ]);

  // prettier-ignore
  expect(cube.groups[0].faces.vertices).toEqual([
    0, 6, 4,
    0, 2, 6,
    0, 3, 2,
    0, 1, 3,
    2, 7, 6,
    2, 3, 7,
    4, 6, 7,
    4, 7, 5,
    0, 4, 5,
    0, 5, 1,
    1, 5, 7,
    1, 7, 3,
  ]);
});

const cubeWithNormals = `
# cube.obj
#

g cube with normals

v  0.0  0.0  0.0
v  0.0  0.0  1.0
v  0.0  1.0  0.0
v  0.0  1.0  1.0
v  1.0  0.0  0.0
v  1.0  0.0  1.0
v  1.0  1.0  0.0
v  1.0  1.0  1.0

vn  0.0  0.0  1.0
vn  0.0  0.0 -1.0
vn  0.0  1.0  0.0
vn  0.0 -1.0  0.0
vn  1.0  0.0  0.0
vn -1.0  0.0  0.0

f  1//2  7//2  5//2
f  1//2  3//2  7//2
f  1//6  4//6  3//6
f  1//6  2//6  4//6
f  3//3  8//3  7//3
f  3//3  4//3  8//3
f  5//5  7//5  8//5
f  5//5  8//5  6//5
f  1//4  5//4  6//4
f  1//4  6//4  2//4
f  2//1  6//1  8//1
f  2//1  8//1  4//1
`;

test("parse cube with normals", () => {
  const cube = ObjFile.create(cubeWithNormals);

  expect(cube.groups.length).toEqual(1);
  expect(cube.groups[0].name).toEqual("cube with normals");
  expect(cube.groups[0].textures.length).toEqual(0);
  expect(cube.groups[0].faces.textures.length).toEqual(0);

  // prettier-ignore
  expect(cube.groups[0].vertices).toEqual([
    0.0, 0.0, 0.0, // 0,
    0.0, 0.0, 1.0, // 1,
    0.0, 1.0, 0.0, // 2,
    0.0, 1.0, 1.0, // 3,
    1.0, 0.0, 0.0, // 4,
    1.0, 0.0, 1.0, // 5,
    1.0, 1.0, 0.0, // 6,
    1.0, 1.0, 1.0, // 7,
  ]);

  // prettier-ignore
  expect(cube.groups[0].faces.vertices).toEqual([
    0, 6, 4,
    0, 2, 6,
    0, 3, 2,
    0, 1, 3,
    2, 7, 6,
    2, 3, 7,
    4, 6, 7,
    4, 7, 5,
    0, 4, 5,
    0, 5, 1,
    1, 5, 7,
    1, 7, 3,
  ]);

  // prettier-ignore
  expect(cube.groups[0].normals).toEqual([
    0.0, 0.0, 1.0,  // 0,
    0.0, 0.0, -1.0, // 1,
    0.0, 1.0, 0.0,  // 2,
    0.0, -1.0, 0.0, // 3,
    1.0, 0.0, 0.0,  // 4,
    -1.0, 0.0, 0.0, // 5,
  ]);

  // prettier-ignore
  expect(cube.groups[0].faces.normals).toEqual([
    1, 1, 1,
    1, 1, 1,
    5, 5, 5,
    5, 5, 5,
    2, 2, 2,
    2, 2, 2,
    4, 4, 4,
    4, 4, 4,
    3, 3, 3,
    3, 3, 3,
    0, 0, 0,
    0, 0, 0,
  ]);
});

const cubeWithTextureVertices = `
# cube.obj
#

g cube with texture vertices

v  0.0  0.0  0.0
v  0.0  0.0  1.0
v  0.0  1.0  0.0
v  0.0  1.0  1.0
v  1.0  0.0  0.0
v  1.0  0.0  1.0
v  1.0  1.0  0.0
v  1.0  1.0  1.0

vt  0.0  0.0  1.0
vt  0.0  0.0 -1.0
vt  0.0  1.0  0.0
vt  0.0 -1.0  0.0
vt  1.0  0.0  0.0
vt -1.0  0.0  0.0

f  1/2  7/2  5/2
f  1/2  3/2  7/2
f  1/6  4/6  3/6
f  1/6  2/6  4/6
f  3/3  8/3  7/3
f  3/3  4/3  8/3
f  5/5  7/5  8/5
f  5/5  8/5  6/5
f  1/4  5/4  6/4
f  1/4  6/4  2/4
f  2/1  6/1  8/1
f  2/1  8/1  4/1
`;

test("parse cube with texture vertices", () => {
  const cube = ObjFile.create(cubeWithTextureVertices);

  expect(cube.groups.length).toEqual(1);
  expect(cube.groups[0].name).toEqual("cube with texture vertices");
  expect(cube.groups[0].normals.length).toEqual(0);
  expect(cube.groups[0].faces.normals.length).toEqual(0);

  // prettier-ignore
  expect(cube.groups[0].vertices).toEqual([
    0.0, 0.0, 0.0,
    0.0, 0.0, 1.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 1.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 1.0,
    1.0, 1.0, 0.0,
    1.0, 1.0, 1.0,
  ]);

  // prettier-ignore
  expect(cube.groups[0].faces.vertices).toEqual([
    0, 6, 4,
    0, 2, 6,
    0, 3, 2,
    0, 1, 3,
    2, 7, 6,
    2, 3, 7,
    4, 6, 7,
    4, 7, 5,
    0, 4, 5,
    0, 5, 1,
    1, 5, 7,
    1, 7, 3,
  ]);

  // prettier-ignore
  expect(cube.groups[0].textures).toEqual([
    0.0, 0.0, 1.0,
    0.0, 0.0, -1.0,
    0.0, 1.0, 0.0,
    0.0, -1.0, 0.0,
    1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
  ]);

  // prettier-ignore
  expect(cube.groups[0].faces.textures).toEqual([
    1, 1, 1,
    1, 1, 1,
    5, 5, 5,
    5, 5, 5,
    2, 2, 2,
    2, 2, 2,
    4, 4, 4,
    4, 4, 4,
    3, 3, 3,
    3, 3, 3,
    0, 0, 0,
    0, 0, 0,
  ]);
});

test("large obj with unknown attributes still loads correctly", () => {
  const objContent = fs.readFileSync(path.join(__dirname, "../../resources/obj/airboat.obj"));
  const obj = ObjFile.create(objContent.toString());

  expect(obj.groups.length).toEqual(17);
  expect(obj.groups[0].vertices.length).toEqual(17391);
});

// Modified from sample in http://www.andrewnoske.com/wiki/OBJ_file_format
const sequentialTriangleGroups = `
g MyTriangleBase

# Bottom left.
v 0 0 0
# Bottom right.
v 5 0 0
# Top    right.
v 5 5 0
# Top    left.
v 0 5 0

# Triangle base.
f 1 2 3

g MyTriangleRoof

# Left side.
v -2 5 0
# Right side.
v 7 5 0
# Top of room.
v 2.5 7 0

# Triangle.
f 5 6 7
`;

test("parse object with sequential groups of triangles", () => {
  const cube = ObjFile.create(sequentialTriangleGroups);

  expect(cube.groups.length).toEqual(2);

  expect(cube.groups[0].name).toEqual("MyTriangleBase");
  expect(cube.groups[0].vertices.length).toEqual(12);
  expect(cube.groups[0].faces.vertices.length).toEqual(3);

  expect(cube.groups[1].name).toEqual("MyTriangleRoof");
  expect(cube.groups[1].vertices.length).toEqual(9);
  expect(cube.groups[1].faces.vertices.length).toEqual(3);

  // prettier-ignore
  expect(cube.getTriangleVertices()).toEqual([
    0,0,0,
    5,0,0,
    5,5,0,

    -2,5,0,
    7,5,0,
    2.5,7,0,
  ]);
});

// Modified from sample in http://www.andrewnoske.com/wiki/OBJ_file_format
const sequentialSquareGroups = `
g MySquare

v 0 0 0   # Bottom left.
v 5 0 0   # Bottom right.
v 5 5 0   # Top    right.
v 0 5 0   # Top    left.

f 1 2 3 4       # Square base.
f 1 2 3 4       # Square base. Repeat to test reindexing of multiple faces
f 1 2 3 4       # Square base. Repeat to test reindexing of multiple faces

g MyTriangleRoof

v -2 5 0    # Left side.
v 7 5 0     # Right side.
v 2.5 7 0   # Top of room.

f 5 6 7        # Triangle.
`;

test("parse object with sequential groups of squares and triangles", () => {
  const cube = ObjFile.create(sequentialSquareGroups);

  expect(cube.groups.length).toEqual(2);

  expect(cube.groups[0].name).toEqual("MySquare");
  expect(cube.groups[0].vertices.length).toEqual(12);
  expect(cube.groups[0].faces.vertices.length).toEqual(18);

  expect(cube.groups[1].name).toEqual("MyTriangleRoof");
  expect(cube.groups[1].vertices.length).toEqual(9);
  expect(cube.groups[1].faces.vertices.length).toEqual(3);

  // prettier-ignore
  expect(cube.getTriangleVertices()).toEqual([
    // From first face
    0,0,0,  // 1
    5,0,0,  // 2
    5,5,0,  // 3

    0,5,0,  // 4
    0,0,0,  // 1
    5,5,0,  // 3

    // From second face
    0,0,0,
    5,0,0,
    5,5,0,

    0,5,0,
    0,0,0,
    5,5,0,

    // From third face
    0,0,0,
    5,0,0,
    5,5,0,

    0,5,0,
    0,0,0,
    5,5,0,

    // From third face
    -2,5,0,
    7,5,0,
    2.5,7,0,
  ]);
});

const sevenComponentFace = `
g MySquare

v 0 0 0    # Bottom left.
v 5 0 0    # Bottom right.
v 5 5 0    # Top    right.
v 0 5 0    # Top    left.
v -2 5 0   # Left side.
v 7 5 0    # Right side.
v 2.5 7 0  # Top of room.

f 1 2 3 4 5 6 7
`;

// This test verifies that a face with more components gets correctly expanded
// out.  The input data has:
// f 1 2 3 4 5 6 7
// And the expected output is
// f 1 2 3
// f 1 3 4
// f 1 4 5
// f 1 5 6
// f 1 6 7
test("parse object with a 7 component face", () => {
  const cube = ObjFile.create(sevenComponentFace);

  expect(cube.groups.length).toEqual(1);

  expect(cube.groups[0].name).toEqual("MySquare");
  expect(cube.groups[0].vertices.length).toEqual(21);
  expect(cube.groups[0].faces.vertices.length).toEqual(15);

  // prettier-ignore
  expect(cube.groups[0].faces.vertices).toEqual([
    0, 1, 2,
    0, 2, 3,
    0, 3, 4,
    0, 4, 5,
    0, 5, 6,
  ]);

  // prettier-ignore
  expect(cube.getTriangleVertices()).toEqual([
    0,0,0,
    5,0,0,
    5,5,0,

    0,0,0,
    5,5,0,
    0,5,0,

    0,0,0,
    0,5,0,
    -2,5,0,

    0,0,0,
    -2,5,0,
    7,5,0,

    0,0,0,
    7,5,0,
    2.5,7,0,
  ]);
});
