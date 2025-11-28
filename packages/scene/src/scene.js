import {Node} from "./node.js";

// Scene is the root container node of a scene graph. It is used to manage the scene
// tree. It is the entry point for rendering the scene.
export class Scene extends Node {
  constructor({name, id} = {}) {
    super({
      type: "scene",
      name: name || "Scene",
      id,
    });
  }

  preRender(context) {
    const transform = context?.sceneManager?.getNodeStateByID(this.id)?.transform;

    if (transform) {
      this.withLocalMatrix(
        mat4.Matrix4.trs(transform.position, transform.rotation, transform.scale)
      );
    }

    this.withWorldMatrix(this.localMatrix);
  }
}
