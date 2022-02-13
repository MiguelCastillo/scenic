import * as React from "react";

const _indexMap = {x: 0, y: 1, z: 2};

export class Coordinates extends React.Component {
  handleChange = (evt) => {
    let value = evt.target.value;

    // Inserting a `-` anywhere in the number field inverts the
    // sign of the current value.
    if (evt.nativeEvent.data === "-") {
      const currentValue = this.props.data[_indexMap[evt.target.name]];
      value = (-currentValue).toString();
    }

    this.props.onChange(evt.target.name, value);
  }

  render() {
    const {data, step="0.1", min, max} = this.props;

    return (
      <div className="coordinates">
        <div className="x">
          <label>x</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            name="x"
            onChange={this.handleChange}
            value={data[0].toString()} />
        </div>
        <div className="y">
          <label>y</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            name="y"
            onChange={this.handleChange}
            value={data[1].toString()} />
        </div>
        <div className="z">
          <label>z</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            name="z"
            onChange={this.handleChange}
            value={data[2].toString()} />
        </div>
      </div>
    );
  }
}
