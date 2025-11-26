import * as React from "react";
import {Coordinates} from "./coordinates.jsx";
import {WithNodeState} from "./with-node-state.jsx";

import {float} from "@scenic/math";
import {normalizeLeadingZero} from "./utils.js";

export class TransformProperties extends WithNodeState {
  _handleChange = (which, axis, value) => {
    const nodeState = this.getNodeState();
    const newTransform = [...nodeState.transform[which]];
    newTransform[_xyzIndexMap[axis]] = value;

    this.updateNodeState({
      ...nodeState,
      transform: {
        ...nodeState.transform,
        [which]: newTransform,
      },
    });
  };

  handleChangePosition = (axis, value) => {
    if (value === "") {
      value = "0";
    }
    value = normalizeLeadingZero(value);
    this._handleChange("position", axis, float.fixed3f(value));
  };

  handleChangeRotation = (axis, value) => {
    if (value === "") {
      value = "0";
    }
    value = normalizeLeadingZero(value);
    this._handleChange("rotation", axis, float.fixed3f(value));
  };

  handleChangeScale = (axis, value) => {
    if (value === "") {
      value = "1";
    }
    value = normalizeLeadingZero(value);
    this._handleChange("scale", axis, float.fixed3f(value));
  };

  render() {
    const {transform} = this.getNodeState();
    return (
      <div className="node-properties transform">
        <div className="position">
          <label>Position</label>
          <Coordinates onChange={this.handleChangePosition} data={transform.position} />
        </div>
        <div className="rotation">
          <label>Rotation</label>
          <Coordinates
            step="1"
            min="-360"
            max="360"
            onChange={this.handleChangeRotation}
            data={transform.rotation}
          />
        </div>
        <div className="scale">
          <label>Scale</label>
          <Coordinates onChange={this.handleChangeScale} data={transform.scale} />
        </div>
      </div>
    );
  }
}

const _xyzIndexMap = {x: 0, y: 1, z: 2};
