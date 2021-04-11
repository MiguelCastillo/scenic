import * as React from "react"

import {SceneContext} from "./scene-context.js";

export class PerspectiveProjectionProperties extends React.Component {
  static contextType = SceneContext;

  _handleChange = (which, evt) => {
    const {node} = this.props;
    node.projection[which] = parseInt(evt.target.value);
    this.forceUpdate();
    this.context.refreshProjection();
  }

  handleChangeFOV = (evt) => {
    this._handleChange("fov", evt);
  }

  handleChangeNear = (evt) => {
    this._handleChange("near", evt);
  }

  handleChangeFar = (evt) => {
    this._handleChange("far", evt);
  }

  render() {
    const {node} = this.props;

    return (
      <div className="node-properties perspective">
        <div className="fov">
          <label>FOV</label>
          <input type="number" onChange={this.handleChangeFOV} value={node.projection.fov}/>
        </div>
        <div className="near">
          <label>Near</label>
          <input type="number" onChange={this.handleChangeNear} value={node.projection.near}/>
        </div>
        <div className="far">
          <label>Far</label>
          <input type="number" onChange={this.handleChangeFar} value={node.projection.far}/>
        </div>
      </div>
    )
  }
}
