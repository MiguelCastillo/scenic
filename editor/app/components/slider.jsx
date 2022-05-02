import * as React from "react";
import "./slider.css";

/**
 * Generates an array of numbers based on a given range.
 *
 * @param {number} start - The start value of the range.
 * @param {number} end - The end value of the range.
 * @returns An array of numbers from start to end.
 */
const range = (start, end) => Array.from({length: end - start + 1}, (_, i) => start + i);

/**
 * A custom slider component that extends the standard input range control.
 */
export default function Slider(props) {
  const {min, max, onChange, value} = props;

  // Create an array of labels for the slider here so these don't have to be
  // recalculated on every render.
  const labels = React.useMemo(() => range(min, max), [min, max]);
  // Calculate the track width based on the selected value.
  // NOTE: This is dynamically calculated and passed as a CSS variable so we
  // can define the track width in the CSS selector.
  const sliderPercentage = 100 - ((value - min) * 100) / (max - min);

  return (
    <div className="slider" style={{"--track-value": sliderPercentage + "%"}}>
      <input
        type="range"
        className="slider-range"
        min={min}
        max={max}
        onChange={onChange}
        value={value}
        list="speeds"
      />
      <datalist id="speeds" className="slider-labels">
        {labels.map((speed) => (
          <option key={speed} value={speed} className="slider-label">
            {speed}
          </option>
        ))}
      </datalist>
    </div>
  );
}
