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
          {/* setting min/max in a numberic input element can cause the element
              to render with a different width than without them. So we are
              padding the min/max values with decimal values so that we can
              make up for the loss of width. Otherwise, the rotation input
              elements will render a lot smaller than the other numeruc input
              elements.
          */}
          <Coordinates step="1" min="-360.0000000000000" max="360" onChange={this.handleChangeRotation} data={node.transform.rotation}/>
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
