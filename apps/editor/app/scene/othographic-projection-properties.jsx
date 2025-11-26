import * as React from "react";
import {WithNodeState} from "./with-node-state.jsx";

export class OrthographicProjectionProperties extends WithNodeState {
  handleChangeFar = (evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      projection: {
        ...nodeState.projection,
        far: parseInt(evt.target.value),
      },
    });

    this.context.refreshProjection();
  };

  render() {
    const {projection} = this.getNodeState();

    return (
      <div className="node-properties orthographic">
        <div className="far">
          <label>Far</label>
          <input type="number" onChange={this.handleChangeFar} value={projection.far} />
        </div>
      </div>
    );
  }
}
