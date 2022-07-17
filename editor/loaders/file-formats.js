/**
 * Shim for fileformats that get bundled in a way that can run in web workers.
 */
import {Timer} from "../../src/utils/timer.js";
import {ObjFile} from "../../src/formats/objfile.js";

export {Timer, ObjFile};
