import * as React from "react";
import {colors} from "@scenic/utils";

export class ColorChannels extends React.Component {
  handleChange = (evt) => {
    this.props.onChange(colors.hexToRgb(evt.target.value));
  };

  render() {
    const {data} = this.props;
    return (
      <div className="color-picker">
        {/* <label>rgb({data[0]}, {data[1]}, {data[2]})</label> */}
        <input type="color" onInput={(evt) => this.handleChange(evt)} value={colors.rgbToHex(...data)} />
      </div>
    );
  }
}
