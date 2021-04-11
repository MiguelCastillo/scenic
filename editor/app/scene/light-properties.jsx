import * as React from "react"
import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

import {fixed3f} from "../../../src/math/angles.js";

export class LightProperties extends WithNodeState {
  handleChangeColor = (value) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      light: {
        ...nodeState.light,
        color: [...value],
      },
    });
  }

  handleChangeIntensity = (evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      light: {
        ...nodeState.light,
        intensity: fixed3f(evt.target.value),
      },
    });
  }

  render() {
    const {light} = this.getNodeState();

    return (
      <div className="node-properties light">
        <div className="color">
          <label>Color</label>
          <ColorChannels onChange={this.handleChangeColor} data={light.color}/>
        </div>
        <div className="intensity">
          <label>Intensity</label>
          <input type="number" step=".1" min="0" max="1" onChange={this.handleChangeIntensity} value={light.intensity} />
        </div>
      </div>
    )
  }
}
