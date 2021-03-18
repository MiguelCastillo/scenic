import * as React from "react";

export class CoordinateProperties extends React.Component {
  handleChange = (which, evt) => {
    this.props.onChange(which, evt.target.value);
  }

  render() {
    const {data, step="0.1", min, max} = this.props;
    return (
      <React.Fragment>
        <div className="x">
          <label>x</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            onChange={(evt) => this.handleChange("x", evt)}
            value={data[0]} />
        </div>
        <div className="y">
          <label>y</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            onChange={(evt) => this.handleChange("y", evt)}
            value={data[1]} />
        </div>
        <div className="z">
          <label>z</label>
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            onChange={(evt) => this.handleChange("z", evt)}
            value={data[2]} />
        </div>
      </React.Fragment>
    );
  }
}