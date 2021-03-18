import * as React from "react"
import {ColorChannelProperties} from "./color-channel-properties.jsx";

export class LightProperties extends React.Component {
  handleChangeColor = (value) => {
    const {node: {light}} = this.props;
    light.color[0] = value[0];
    light.color[1] = value[1];
    light.color[2] = value[2];
    this.forceUpdate();
  }

  handleChangeIntensity = (evt) => {
    const {node: {light}} = this.props;
    light.intensity = evt.target.value;
    this.forceUpdate();
  }

  render() {
    const {node: {light}} = this.props;

    return (
      <div className="node-properties light">
        <div className="color">
          <div className="label">Color</div>
          <div className="value">
            <ColorChannelProperties onChange={this.handleChangeColor} data={light.color}/>
          </div>
        </div>
        <div className="intensity">
          <div className="label">Intensity</div>
          <div className="value">
            <div className="intensity-coefficient">
              <label>i</label>
              <input type="number" step=".1" min="0" max="1" onChange={this.handleChangeIntensity} value={light.intensity} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
