import {Animation} from "./animation.js";
import {Mesh} from "./mesh.js";

// SkinnedMesh is a mesh that is animated with bones.
export class SkinnedMesh extends Mesh {
  constructor(options) {
    super({...options, type: "skinned-mesh"});

    // We have an animation node to make it simpler to find animation data.
    // This is the fundamental difference between a static-mesh and a
    // skinned-mesh.
    this.animation = null;
  }

  add(node) {
    if (node instanceof Animation) {
      this.animation = node;
    }

    super.add(node);
    return this;
  }
}
