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

  render() {
    const animationState = this.getNodeState();
    return (
      <div className="node-properties animation">
        {animationState.stackNames && animationState.stackNames.length &&
          <div className="animation-stack">
            <label>Stack</label>
            <AnimationStackSelect options={animationState.stackNames} onChange={this.selectAnimationStack}/>
          </div>
        }
        <div className="speed">
          <label>Speed</label>
          <input type="number" step=".1" onChange={this.handletAnimationSpeedChange} value={animationState.speed} />
        </div>
      </div>
    )
  }
}

const SELECT_STACK = "__select";

class AnimationStackSelect extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: SELECT_STACK,
    };
  }

  handleStackChange = (evt) => {
    const selectedValue = evt.target.value;
    this.setState({
      selectedValue,
    });

    const {onChange} = this.props;
    if (onChange) {
      if (selectedValue === SELECT_STACK) {
        onChange(null);
      } else {
        onChange(selectedValue);
      }
    }
  }

  render() {
    const {options=[]} = this.props;
    const {selectedValue} = this.state;
    return (
      <select name="animation" onChange={this.handleStackChange} value={selectedValue}>
        <option value={SELECT_STACK}>Select</option>
        {options.map((o, i) => {
          if (selectedValue === o) {
            return <option value={o} key={o+"_"+i} selected>{o}</option>;
          } else {
            return <option value={o} key={o+"_"+i}>{o}</option>;
          }
        })}
      </select>
    )
  }
}
