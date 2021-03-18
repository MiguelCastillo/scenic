import * as React from "react";
import {rgbToHex, hexToRgb} from "../../../src/colors.js";

export class ColorChannelProperties extends React.Component {
  handleChange = (evt) => {
    this.props.onChange(hexToRgb(evt.target.value));
  }

  render() {
    const {data} = this.props;
    return (
      <React.Fragment>
        <div className="picker">
          <label>rgb({data[0]}, {data[1]}, {data[2]})</label>&nbsp;
          <input type="color" onInput={(evt) => this.handleChange(evt)} value={rgbToHex(...data)} />
        </div>
      </React.Fragment>
    );
  }
}
