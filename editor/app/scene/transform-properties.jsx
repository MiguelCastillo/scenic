import * as React from "react";
import {Coordinates} from "./coordinates.jsx";
import {WithNodeState} from "./with-node-state.jsx";

import {fixed3f} from "../../../src/math/angles.js";

export class TransformProperties extends WithNodeState {
  _handleChange = (which, axis, value) => {
    const nodeState = this.getNodeState();
    const newTransform = [...nodeState.transform[which]];
    newTransform[xyzToIndex(axis)] = value;

    this.updateNodeState({
      ...nodeState,
      transform: {
        ...nodeState.transform,
        [which]: newTransform,
      },
    });
  }

  handleChangePosition = (axis, value) => {
    this._handleChange("position", axis, fixed3f(value));
  }

  handleChangeRotation = (axis, value) => {
    this._handleChange("rotation", axis, parseInt(value));
  }

  handleChangeScale = (axis, value) => {
    this._handleChange("scale", axis, fixed3f(value));
  }

  render() {
    const {transform} = this.getNodeState();

    return (
      <div className="node-properties transform">
        <div className="position">
          <label>Position</label>
          <Coordinates onChange={this.handleChangePosition} data={transform.position}/>
        </div>
        <div className="rotation">
          <label>Rotation</label>
          {/* setting min/max in a numberic input element can cause the element
              to render with a different width than without them. So we are
              padding the min/max values with decimal values so that we can
              make up for the loss of width. Otherwise, the rotation input
              elements will render a lot smaller than the other numeruc input
              elements.
          */}
          <Coordinates step="1" min="-360.0000000000000" max="360" onChange={this.handleChangeRotation} data={transform.rotation}/>
        </div>
        <div className="scale">
          <label>Scale</label>
          <Coordinates onChange={this.handleChangeScale} data={transform.scale}/>
        </div>
      </div>
    )
  }
}

export function xyzToIndex(which) {
  switch(which) {
    case "x":
      return 0;
    case "y":
      return 1;
    case "z":
      return 2;
  }
}
