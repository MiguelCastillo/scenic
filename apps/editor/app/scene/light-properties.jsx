import * as React from "react";
import {float} from "@scenic/math";

import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

// LightProperties edits a light's color and intensity. A light inside a sky
// can also be marked as the sun, which the sky paints its sun for.
export class LightProperties extends WithNodeState {
  handleChangeSun = (evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      light: {
        ...nodeState.light,
        sun: evt.target.checked,
      },
    });
  };

  handleChangeColor = (value) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      light: {
        ...nodeState.light,
        color: [...value],
      },
    });
  };

  handleChangeIntensity = (evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      light: {
        ...nodeState.light,
        intensity: float.fixed3f(evt.target.value),
      },
    });
  };

  render() {
    const {light} = this.getNodeState();
    const inSky = this.props.node.parent?.type === "sky";

    return (
      <div className="node-properties light">
        <div className="color">
          <label>Color</label>
          <ColorChannels onChange={this.handleChangeColor} data={light.color} />
        </div>
        <div className="intensity">
          <label>Intensity</label>
          <input
            type="number"
            step=".1"
            min="0"
            max="1"
            onChange={this.handleChangeIntensity}
            value={light.intensity}
          />
        </div>
        {inSky && (
          <div className="sun">
            <label>Sun</label>
            <input type="checkbox" onChange={this.handleChangeSun} checked={!!light.sun} />
          </div>
        )}
      </div>
    );
  }
}
