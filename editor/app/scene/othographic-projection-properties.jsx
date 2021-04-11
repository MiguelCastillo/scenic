import * as React from "react"

import {SceneContext} from "./scene-context.js";

export class OrthographicProjectionProperties extends React.Component {
  static contextType = SceneContext;

  handleChangeFar = (evt) => {
    const {node} = this.props;
    node.projection.far = parseInt(evt.target.value);
    this.forceUpdate();
    this.context.refreshProjection();
  }

  render() {
    const {node} = this.props;

    return (
      <div className="node-properties orthographic">
        <div className="far">
          <label>Far</label>
          <input type="number" onChange={this.handleChangeFar} value={node.projection.far}/>
        </div>
      </div>
    )
  }
}
