import * as React from "react"
import {Coordinates} from "./coordinates.jsx";

export class TransformProperties extends React.Component {
  handleChangePosition = (which, value) => {
    const {node:{transform}} = this.props;
    transform.position[xyzToIndex(which)] = value;
    this.forceUpdate();
  }

  handleChangeRotation = (which, value) => {
    const {node:{transform}} = this.props;
    transform.rotation[xyzToIndex(which)] = value;
    this.forceUpdate();
  }

  handleChangeScale = (which, value) => {
    const {node:{transform}} = this.props;
    transform.scale[xyzToIndex(which)] = value;
    this.forceUpdate();
  }

  render() {
    const {node} = this.props;

    return (
      <div className="node-properties transform">
        <div className="position">
          <label>Position</label>
          <Coordinates onChange={this.handleChangePosition} data={node.transform.position}/>
        </div>
        <div className="rotation">
          <label>Rotation</label>
          <Coordinates step="1" min="-360" max="360" onChange={this.handleChangeRotation} data={node.transform.rotation}/>
        </div>
        <div className="scale">
          <label>Scale</label>
          <Coordinates onChange={this.handleChangeScale} data={node.transform.scale}/>
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
