import * as React from "react";
import "./slider.css";

/**
 *
 * @param {number} start - The start value of the range.
 * @param {number} end - The end value of the range.
 * @param {number} step - The increment given to each step.
 * @returns An array of numbers from start to end with increments based on step
 */
const range = (start, end, step) =>
  Array.from({length: (end - start) / step + 1}, (_, i) => start + i * step);

/**
 * A custom slider component that extends the standard input range control.
 */
export default class Slider extends React.Component {
  labels = [];

  constructor(props) {
    super(props);
    const {min, max, step} = this.props;

    // Create an array of labels for the slider here so these don't have to be
    // recalculated on every render.
    this.labels = range(min, max, step);
  }

  render() {
    const {min, max, onChange, step, value} = this.props;
    // Calculate the track width based on the selected value.
    // NOTE: This is dynamically calculated and passed as a CSS variable so we
    // can define the track width in the CSS selector.
    const sliderPercentage = 100 - ((value - min) * 100) / (max - min);

    return (
      <div className="slider" style={{"--track-value": sliderPercentage + "%"}}>
        <input
          type="range"
          className="slider-range"
          step={step}
          min={min}
          max={max}
          onChange={onChange}
          value={value}
          list="speeds"
        />
        <datalist id="speeds" className="slider-labels">
          {this.labels.map((speed) => (
            <option key={speed} value={speed} style={{display: "grid"}}>
              {speed}
            </option>
          ))}
        </datalist>
      </div>
    );
  }
}

Slider.defaultProps = {
  step: 1,
};
