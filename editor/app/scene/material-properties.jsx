import * as React from "react"
import {ColorChannels} from "./color-channels.jsx";

export class MaterialProperties extends React.Component {
  handleChangeColor = (value) => {
    const {node: {material}} = this.props;
    material.color[0] = value[0];
    material.color[1] = value[1];
    material.color[2] = value[2];
    this.forceUpdate();
  }

  handleChangeReflectiveness = (evt) => {
    const {node: {material}} = this.props;
    material.reflectiveness = evt.target.value;
    this.forceUpdate();
  }

  render() {
    const {node: {material}} = this.props;

    return (
      <div className="node-properties material">
        <div className="color">
          <div className="label">Color</div>
          <div className="value">
            <ColorChannels onChange={this.handleChangeColor} data={material.color}/>
          </div>
        </div>
        <div className="reflectiveness">
          <div className="label">Reflectiveness</div>
          <div className="value">
            <div className="reflective-coefficient">
              <label>r</label>
              <input type="number" step=".1" min="0" max="1" onChange={this.handleChangeReflectiveness} value={material.reflectiveness} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
