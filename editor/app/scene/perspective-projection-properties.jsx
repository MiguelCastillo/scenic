import * as React from "react";
import {WithNodeState} from "./with-node-state.jsx";

export class PerspectiveProjectionProperties extends WithNodeState {
  _handleChange = (which, evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      projection: {
        ...nodeState.projection,
        [which]: parseInt(evt.target.value),
      },
    });

    this.context.refreshProjection();
  };

  handleChangeFOV = (evt) => {
    this._handleChange("fov", evt);
  };

  handleChangeNear = (evt) => {
    this._handleChange("near", evt);
  };

  handleChangeFar = (evt) => {
    this._handleChange("far", evt);
  };

  render() {
    const {projection} = this.getNodeState();

    return (
      <div className="node-properties perspective">
        <div className="fov">
          <label>FOV</label>
          <input type="number" onChange={this.handleChangeFOV} value={projection.fov} />
        </div>
        <div className="near">
          <label>Near</label>
          <input type="number" onChange={this.handleChangeNear} value={projection.near} />
        </div>
        <div className="far">
          <label>Far</label>
          <input type="number" onChange={this.handleChangeFar} value={projection.far} />
        </div>
      </div>
    );
  }
}
