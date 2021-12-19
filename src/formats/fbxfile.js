// https://download.autodesk.com/us/fbx/20112/fbx_sdk_help/index.html
// https://docs.fileformat.com/3d/fbx/
// https://banexdevblog.wordpress.com/2014/06/23/a-quick-tutorial-about-the-fbx-ascii-format/
// https://code.blender.org/2013/08/fbx-binary-file-format-specification/
// https://stackoverflow.com/questions/57032793/why-is-there-a-long-list-of-polygonvertexindex-without-any-negatives-in-one-fbx

import * as pako from "pako";

export class FbxFile {
  static fromBinary(buffer) {
    const bufferReader = new BufferReader(buffer);
    const {binaryParser} = createParser(bufferReader);

    let node = new Node();
    let done = false;

    do {
      const {
        endOffset,
        propertyCount,
        name,
      } = binaryParser.readHeader();

      let propertyValues = [];
      for (let i = 0; i < propertyCount; i++) {
        propertyValues.push(binaryParser.readPropertyValues());
      }

      // Loosely equal comparissons for endOffset and
      // propertyCount because BintInt and Number are
      // loosely equal but not strictly equal.
      if (bufferReader.currentPos == endOffset) {
        if (propertyCount) {
          node.properties.push({
            name,
            value: propertyCount == 1 ? propertyValues[0] : propertyValues,
          });
        }
      } else {
        if (endOffset) {
          // Create a child node and make it the current
          // node to parse data into it.
          const newNode = new Node(name, node);
          newNode.attributes = propertyValues;
          node = newNode;
        } else {
          if (node.parent) {
            node = node.parent;
          } else {
            done = true;
          }
        }
      }
    } while(!done);

    return node;
  }
}

export class Node {
  constructor(name, parent) {
    this.name = name;
    this.parent = parent;
    this.attributes = [];
    this.properties = [];
    this.children = [];

    if (parent) {
      parent.children.push(this);
    }
  }

  toJSON = (key) => {
    // Let's skip parent to avoid circular references!
    if (key === "parent") {
      return undefined;
    }

    return this;
  };
}

export const findPropertyValueByName = (node, name) => {
  const p = node.properties.find(p => p.name === name);
  if (!p) {
    return undefined;
  }

  return p.value;
};

export const findChildByName = (node, name) => {
  return node.children.find(c => c.name === name);
};

export const findChildrenByName = (node, name) => {
  return node.children.filter(c => c.name === name);
};

// createParser is a factory for creating fbx parsers.
function createParser(bufferReader) {
  // Not user.  So we are just going to skip this data.
  const fileHeader = [
    bufferReader.getString(21),
    bufferReader.getUint8(), bufferReader.getUint8(),
    bufferReader.getUint32()];

  let binaryParser;

  // Format version.
  // https://help.autodesk.com/view/FBX/2016/ENU/?guid=__cpp_ref_fbxio_8h_html
  const [,,,version] = fileHeader;
  if (version === 7400) {
    binaryParser = new BinaryParser7400(bufferReader);
  } else if (version === 7500) {
    binaryParser = new BinaryParser7500(bufferReader);
  } else {
    throw new Error("version not supported: " + version)
  }

  return {
    fileHeader,
    binaryParser,
  };
}

class BinaryParser {
  constructor(bufferReader) {
    this.bufferReader = bufferReader;
  }

  readPropertyValues() {
    const {bufferReader} = this;
    let propertyData;
    const typeCode = bufferReader.getChar();
    switch(typeCode) {
      case "Y":
        propertyData = bufferReader.getInt16();
        break;
      case "C":
        propertyData = Boolean(bufferReader.getUint8());
        break;
      case "I":
        propertyData = bufferReader.getInt32();
        break;
      case "F":
        propertyData = bufferReader.getFloat32();
        break;
      case "D":
        propertyData = bufferReader.getFloat64();
        break;
      case "L":
        propertyData = [bufferReader.getInt32(), bufferReader.getInt32()];
        // propertyData = bufferReader.getBigInt64();
        break;
      case "S":
        propertyData = bufferReader.getString(bufferReader.getInt32());
        break;
      case "R":
        propertyData = bufferReader.getBytes(bufferReader.getInt32());
        break;
      default:
        propertyData = this.readArray(typeCode);
        break;
    }

    return propertyData;
  }

  readArray(typeCode) {
    if (!byteCountTable[typeCode]) {
      return [];
    }

    const {bufferReader} = this;
    const arrayLength = bufferReader.getUint32();
    const encoding = bufferReader.getUint32();
    const compressedLength = bufferReader.getUint32();
    let result = bufferReader.getBytes(encoding ? compressedLength : arrayLength * byteCountTable[typeCode]);

    if (encoding) {
      const decomp = pako.inflate(result);
      result = decomp.buffer;
    }

    const b = new BufferReader(result);
    const r = [];

    switch(typeCode) {
      case "b":
        for (let i = 0; i < arrayLength; i++) {
          r[i] = Boolean(b.getInt8());
        }
        break;
      case "f":
        for (let i = 0; i < arrayLength; i++) {
          r[i] = b.getFloat32();
        }
        break;
      case "i":
        for (let i = 0; i < arrayLength; i++) {
          r[i] = b.getInt32();
        }
        break;
      case "d":
        for (let i = 0; i < arrayLength; i++) {
          r[i] = b.getFloat64();
        }
        break;
      case "l":
        for (let i = 0; i < arrayLength; i++) {
          r[i] = b.getBigInt64();
        }
        break;
    }

    return r;
  }
}

class BinaryParser7400 extends BinaryParser {
  readHeader() {
    const {bufferReader} = this;
    // When there is no more data left for the current
    // node in the buffer, we read a total of 13 bytes.
    // This gets us to start of the next node.
    // I am not entirely sure if reading an empty header
    // has any particular purpose or it is just for
    // convenience of how the parser is written to allow
    // to read an empty header to signify the end of a
    // node in the buffer.
    return {
      endOffset: bufferReader.getUint32(),                   // 4 bytes
      propertyCount: bufferReader.getUint32(),               // 4 bytes
      propertyListLength: bufferReader.getUint32(),          // 4 bytes
      name: bufferReader.getString(bufferReader.getUint8()), // 1 byte
    };
  }
}

class BinaryParser7500 extends BinaryParser {
  readHeader() {
    const {bufferReader} = this;
    return {
      endOffset: bufferReader.getBigUint64(),                // 8 bytes
      propertyCount: bufferReader.getBigUint64(),            // 8 bytes
      propertyListLength: bufferReader.getBigUint64(),       // 8 bytes
      name: bufferReader.getString(bufferReader.getUint8()), // 1 byte
    };
  }
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
const littleEndian = (() => {
  var buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
  // Int16Array uses the platform's endianness.
  return new Int16Array(buffer)[0] === 256;
})();

class BufferReader {
  constructor(buffer) {
    this.buffer = buffer
    this.view = new DataView(buffer);
    this.currentPos = 0;
  }

  forward(amount) {
    this.currentPos += amount;
  }

  seek(position) {
    this.currentPos = position;
  }

  getChar() {
    return String.fromCharCode(this.getUint8());
  }

  getString(length) {
    if (!length) {
      return "";
    }

    let r = "";
    const chunkSize = 512;
    let startOffset = 0;
    let endOffset = chunkSize;

    // We will chunk this up so that we don't causes
    // issues with passing too many items to `fromCharCode`.
    while (startOffset !== length) {
      if (endOffset > length) {
        endOffset = length;
      }

      const chars = new Uint8Array(
        this.buffer.slice(
          this.currentPos + startOffset,
          this.currentPos + endOffset,
        )
      );

      r += String.fromCharCode(...chars);

      startOffset = endOffset;
      endOffset += chunkSize;
    }

    this.currentPos += length;
    return r;
  }

  getRemainingBytes() {
    return this.buffer.slice(this.currentPos, this.currentPos + (this.buffer.byteLength - this.currentPos));
  }

  getBytes(byteCount) {
    const result = this.buffer.slice(this.currentPos, this.currentPos + byteCount);
    this.currentPos += byteCount;
    return result;
  }

  getInt8(littleEnd=littleEndian) {
    return this.view.getInt8(this.currentPos++, littleEnd);
  }

  getUint8(littleEnd=littleEndian) {
    return this.view.getUint8(this.currentPos++, littleEnd);
  }

  getInt16(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 2;
    return this.view.getInt8(idx, littleEnd);
  }

  getUint16(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 2;
    return this.view.getUint16(idx, littleEnd);
  }

  getInt32(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 4;
    return this.view.getInt32(idx, littleEnd);
  }

  getUint32(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 4;
    return this.view.getUint32(idx, littleEnd);
  }

  getFloat32(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 4;
    return this.view.getFloat32(idx, littleEnd);
  }

  getFloat64(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 8;
    return this.view.getFloat64(idx, littleEnd);
  }

  getBigInt64(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 8;
    // JavaScript doesn't support 64 bit ints. So, we
    // are just going to return a string.
    return this.view.getBigInt64(idx, littleEnd);
  }

  getBigUint64(littleEnd=littleEndian) {
    const idx = this.currentPos;
    this.currentPos += 8;
    // JavaScript doesn't support 64 bit ints. So, we
    // are just going to return a string.
    return this.view.getBigUint64(idx, littleEnd);
  }
}

const byteCountTable = {
  "b": 1, // boolean is 1 byte
  "i": 4, // integer is 4 bytes
  "f": 4, // float is 4 bytes
  "d": 8, // double is 8 bytes
  "l": 8, // long is 8 bytes
};

// Support JSON serialization of BigInt
BigInt.prototype.toJSON = function() { return this.toString(); }

// triangulatePolygonIndexes returns a new array from the provided polygon
// indexes; PolygonVertexIndex. The new indexes are created from the polygon
// groups which are delimeted by negative indexes and we use them for creating
// the triangle coordinates indexes that are returned.
// 
// The formula to convert the negative index is formuala `-(x-1)`. We use the
// first index as the first coordinate index for every triangle we generate.
// Then we will go thru each pair of subsequent indexes to create the others
// triangle coordinate indexes.
// Consider the following PolygonVertexIndex
// [0, 4, 6, -3]
//
// 1. Convert the -3 with `-(x+1)`. -(-3+1) == 2`
//    [0, 4, 6, 2]
// 2. Create the first triangle coordinate indexes
//    [0, 4, 6]
// 3. Create the second triangle coordinate indexes
//    [0, 6, 2].
// 4. The final array of indexes
//    [0, 4, 6, 0, 6, 2]
export function triangulatePolygonIndexes(indexes) {
  let triangleIndexes = [];
  let polygon = [];

  for (let i = 0; i < indexes.length; i++) {
    for (let j = 0; true; j++, i++) {
      // Negative values mean the end of a polygon. So
      // we stop here to triangulate the polygon.
      if (indexes[i] < 0) {
        polygon[j] = -(indexes[i] + 1);
        break;
      }

      polygon[j] = indexes[i];
    }

    for (let j = 1; j < polygon.length - 1; j++) {
      triangleIndexes.push(polygon[0], polygon[j], polygon[j + 1]);
    }

    polygon = [];
  }

  return triangleIndexes;
}

// mapIndexByPolygonVertex returns an array of indexes derrived from polygon
// vertex indexes; PolygonVertexIndex. The way it works start by finding
// polygon groups in the indexes, which are delimeted by a negative number.
// We then create new indexes for those polygons. We do not use the polygon
// themselves, we instead will create new ones from the indexes used for
// iterating thru the polygon indexes themselves.
export function mapIndexByPolygonVertex(indexes) {
  let normalsIndexes = [];

  for (let i = 0, offset = 0; i < indexes.length; i++) {
    if (indexes[i] >= 0) {
      continue;
    }

    for (let start = offset; start < i - 1; start++) {
      normalsIndexes.push(offset, start + 1, start + 2);
    }
    offset = i+1;
  }

  return normalsIndexes;
}
