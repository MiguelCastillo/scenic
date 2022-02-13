import * as React from "react";
import {WithNodeState} from "./with-node-state.jsx";

export class AnimationProperties extends WithNodeState {
  selectAnimationStack = (stackName) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      stackName,
    });
  }

  handletAnimationSpeedChange = (evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      speed: evt.target.value,
    });
  }

  handletAnimationMSChange = (evt) => {
    const ms = evt.target.value === "" ? null : evt.target.value;
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      ms,
    });
  }

  render() {
    const animationState = this.getNodeState();
    return (
      <div className="node-properties animation">
        {animationState.stackNames && animationState.stackNames.length &&
          <div className="animation-stack">
            <label>Stack</label>
            <AnimationStackSelect options={animationState.stackNames} selected={animationState.stackName} onChange={this.selectAnimationStack}/>
          </div>
        }
        <div className="speed">
          <label>Speed</label>
          <input type="number" step=".1" onChange={this.handletAnimationSpeedChange} value={animationState.speed} />
        </div>
        <div className="ms">
          <label>ms</label>
          <input type="number" step="10" onChange={this.handletAnimationMSChange} value={animationState.ms||""} />
        </div>
      </div>
    )
  }
}

const SELECT_STACK = "__select";

class AnimationStackSelect extends React.Component {
  handleStackChange = (evt) => {
    const selectedValue = evt.target.value;
    const {onChange} = this.props;
    if (onChange) {
      if (selectedValue === SELECT_STACK) {
        onChange(undefined);
      } else {
        onChange(selectedValue);
      }
    }
  }

  render() {
    const {options=[], selected} = this.props;
    return (
      <select name="animation" onChange={this.handleStackChange} value={selected}>
        <option value={SELECT_STACK}>Select</option>
        {options.map((o, i) => {
          return <option value={o} key={o+"_"+i}>{o}</option>;
        })}
      </select>
    )
  }
}
