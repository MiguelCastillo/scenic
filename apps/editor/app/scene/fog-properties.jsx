import * as React from "react";

import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

// Fog a viewport gets when it is turned on and the viewport has none yet.
// Black matches the background.
const defaultFog = {color: [0, 0, 0], near: 1000, far: 3000};

// FogProperties edits a viewport's `fog` state. Turning fog off keeps its
// settings, with `enabled: false`, so turning it back on restores them.
export class FogProperties extends WithNodeState {
  updateFog = (changes) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      fog: {
        ...defaultFog,
        ...nodeState.fog,
        ...changes,
      },
    });
  };

  handleChangeEnabled = (evt) => {
    this.updateFog({enabled: evt.target.checked});
  };

  handleChangeColor = (value) => {
    this.updateFog({color: [...value]});
  };

  handleChangeDistance = (which, evt) => {
    this.updateFog({[which]: parseInt(evt.target.value)});
  };

  render() {
    const {fog} = this.getNodeState();
    const enabled = !!fog && fog.enabled !== false;
    const {color, near, far} = {...defaultFog, ...fog};

    return (
      <div className="node-properties fog">
        <div className="enabled">
          <label>Enabled</label>
          <input type="checkbox" onChange={this.handleChangeEnabled} checked={enabled} />
        </div>
        {enabled ? (
          <>
            <div className="color">
              <label>Color</label>
              <ColorChannels onChange={this.handleChangeColor} data={color} />
            </div>
            <div className="near">
              <label>Near</label>
              <input
                type="number"
                step="100"
                min="0"
                onChange={(evt) => this.handleChangeDistance("near", evt)}
                value={near}
              />
            </div>
            <div className="far">
              <label>Far</label>
              <input
                type="number"
                step="100"
                min="0"
                onChange={(evt) => this.handleChangeDistance("far", evt)}
                value={far}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
