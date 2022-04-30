import * as React from "react";
import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

import {fixed3f} from "../../../src/math/float.js";

export class MaterialProperties extends WithNodeState {
  handleChangeColor = (value) => {
    const nodeState = this.getNodeState();
    const {
      material: {color},
    } = nodeState;

    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        // The color selector component does not support selecting alpha
        // channels, so we just copy whatever already in the state.
        color: [...value, color[3]],
      },
    });
  };

  handleChangeReflectiveness = (evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        reflectiveness: fixed3f(evt.target.value),
      },
    });
  };

  render() {
    const {material} = this.getNodeState();
    if (!material) {
      return null;
    }

    return (
      <div className="node-properties material">
        {material.color != null ?
          <div className="color">
            <label>Color</label>
            <ColorChannels onChange={this.handleChangeColor} data={material.color} />
          </div> : null}
        <div className="reflectiveness">
          <label>Reflect</label>
          <input
            type="number"
            step=".1"
            min="0"
            max="1"
            onChange={this.handleChangeReflectiveness}
            value={material.reflectiveness}
          />
        </div>
      </div>
    );
  }
}
