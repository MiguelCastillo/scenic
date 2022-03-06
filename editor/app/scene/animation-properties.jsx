import * as React from "react";
import {
  PlayOutline,
  PauseOutline,
} from "iconoir-react";
import {WithNodeState} from "./with-node-state.jsx";

export class AnimationProperties extends WithNodeState {
  selectAnimationStack = (stackName) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      stackName,
      state: "paused",
    });
  }

  handletAnimationSpeedChange = (evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      speed: evt.target.value,
    });
  }

  handlePlay = () => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      state: "play",
    });
  }

  handlePause = () => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      state: "paused",
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
        <div className="animaton-controls">
          {animationState.state !== "play" ? <button name="play" onClick={this.handlePlay}><PlayOutline /></button> : null}
          {animationState.state === "play" ? <button name="pause" onClick={this.handlePause}><PauseOutline /></button> : null}
        </div>
      </div>
    )
  }
}

class AnimationStackSelect extends React.Component {
  handleStackChange = (evt) => {
    const selectedValue = evt.target.value;
    const {onChange} = this.props;
    if (onChange) {
      onChange(selectedValue);
    }
  }

  render() {
    const {options=[], selected} = this.props;
    return (
      <select name="animation" onChange={this.handleStackChange} value={selected}>
        {options.map((o, i) => {
          return <option value={o} key={o+"_"+i}>{o}</option>;
        })}
      </select>
    )
  }
}
