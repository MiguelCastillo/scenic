import * as React from "react";
import {
  PlayOutline,
  PauseOutline,
  SkipNextOutline,
  SkipPrevOutline,
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

  handlePlaybackState = (type) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      state: type,
    });
  }

  handlePlay = () => {
    this.handlePlaybackState("play");
  }

  handlePause = () => {
    this.handlePlaybackState("paused");
  }

  handlePrevFrame = () => {
    this.handlePlaybackState("prev");
  }

  handleNextFrame = () => {
    this.handlePlaybackState("next");
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
          <button className="prev" name="prev" onClick={this.handlePrevFrame}><SkipPrevOutline /></button>
          {animationState.state !== "play" ? <button className="play" name="play" onClick={this.handlePlay}><PlayOutline /></button> : null}
          {animationState.state === "play" ? <button className="pause" name="pause" onClick={this.handlePause}><PauseOutline /></button> : null}
          <button className="next" name="next" onClick={this.handleNextFrame}><SkipNextOutline /></button>
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
