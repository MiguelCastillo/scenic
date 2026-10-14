import * as React from "react";

import {WithNodeState} from "./with-node-state.jsx";

// ThirdPersonProperties edits the third-person settings of a camera that the
// third-person camera reads every frame, so changes show up live while it
// follows its target: how far it looks up past the target, how quickly it
// catches up when the target turns, where the pivot it orbits is, and whether
// the mouse orbits it. The
// other settings, such as its starting distance and orbit, only apply when the
// camera switches to third person.
export class ThirdPersonProperties extends WithNodeState {
  updateSettings = (changes) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      camera: {
        ...nodeState.camera,
        thirdPerson: {...nodeState.camera.thirdPerson, ...changes},
      },
    });
  };

  // number reads a number field, or null while what is typed is not a number
  // yet, such as a lone "-", so that the setting is left alone.
  number = (evt) => {
    const value = parseFloat(evt.target.value);
    return Number.isNaN(value) ? null : value;
  };

  handleChange = (name, evt) => {
    const value = this.number(evt);
    if (value != null) {
      this.updateSettings({[name]: value});
    }
  };

  handleChangeOffset = (axis, evt) => {
    const value = this.number(evt);
    if (value != null) {
      const offset = [...this.getNodeState().camera.thirdPerson.offset];
      offset[axis] = value;
      this.updateSettings({offset});
    }
  };

  render() {
    const settings = this.getNodeState().camera?.thirdPerson;
    if (!settings) {
      return null;
    }

    const {lookUp = 0, followTime, offset, mouseOrbit = true} = settings;

    return (
      <div className="node-properties third-person">
        <div className="mouse-orbit">
          <label>Mouse orbits</label>
          <input
            type="checkbox"
            onChange={(evt) => this.updateSettings({mouseOrbit: evt.target.checked})}
            checked={mouseOrbit}
          />
        </div>
        <div className="look-up">
          <label>Look up</label>
          <input
            type="number"
            step="1"
            onChange={(evt) => this.handleChange("lookUp", evt)}
            value={lookUp}
          />
        </div>
        <div className="follow-time">
          <label>Follow time</label>
          <input
            type="number"
            step="0.05"
            min="0"
            onChange={(evt) => this.handleChange("followTime", evt)}
            value={followTime}
          />
        </div>
        {["x", "y", "z"].map((axis, i) => (
          <div className={`offset ${axis}`} key={axis}>
            <label>Offset {axis}</label>
            <input
              type="number"
              step="5"
              onChange={(evt) => this.handleChangeOffset(i, evt)}
              value={offset[i]}
            />
          </div>
        ))}
      </div>
    );
  }
}
