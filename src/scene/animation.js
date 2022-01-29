import {Node} from "./node.js";

export class Animation extends Node {
  constructor(options) {
    super(Object.assign({}, options, {type: "animation"}));
  }
}
