import {Mesh} from "./mesh.js";

// SceneNodeMesh renders meshes. These are the node that lighting is applied
// to. These nodes also have material properties which define the default
// color for the mesh as well other properties that affect lighting such as
// reflectiveness.
export class StaticMesh extends Mesh {
  constructor(options) {
    super({...options, type: "static-mesh"});
  }

  render(context) {
    Mesh.render(context, this);
  }
}
