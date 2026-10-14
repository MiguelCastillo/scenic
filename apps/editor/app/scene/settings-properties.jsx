import * as React from "react";

import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

// label turns a setting's name into words, such as "cloudCover" into
// "Cloud cover".
const label = (name) => {
  const words = name.replace(/([A-Z])/g, " $1").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
};

// SettingsProperties edits a block of settings in a node's state, such as a
// sky's "sky" or a grid's "grid", for nodes that read them every frame, so
// changes show up live. Colors, which are [r, g, b] lists, get color pickers
// and numbers get number fields. Text is shown but not edited. It shows the
// settings in the node's state, so the scene config lists the ones to tune,
// plus any defaults.
//
// Props:
// - settingsKey: the name of the block in the node's state.
// - steps: how much the arrows change a setting, by name. Optional.
// - defaultStep: the step for settings steps leaves out. 0.05 by default.
// - defaults: settings to show when the node's state leaves them out, with
//   the values the node uses for them. Optional. Editing one adds it to the
//   node's state.
export class SettingsProperties extends WithNodeState {
  updateSetting = (name, value) => {
    const {settingsKey} = this.props;
    const nodeState = this.getNodeState();
    this.updateNodeState({...nodeState, [settingsKey]: {...nodeState[settingsKey], [name]: value}});
  };

  handleChangeNumber = (name, evt) => {
    const value = parseFloat(evt.target.value);
    // Leave the setting alone while what is typed is not a number yet, such
    // as a lone "-".
    if (!Number.isNaN(value)) {
      this.updateSetting(name, value);
    }
  };

  getSettings() {
    const {settingsKey, defaults = {}} = this.props;
    return {...defaults, ...this.getNodeState()[settingsKey]};
  }

  renderSetting(name, value) {
    const {steps = {}, defaultStep = 0.05} = this.props;
    if (typeof value === "string") {
      return <span>{value}</span>;
    }
    if (Array.isArray(value)) {
      return <ColorChannels onChange={(rgb) => this.updateSetting(name, [...rgb])} data={value} />;
    }
    return (
      <input
        type="number"
        step={steps[name] ?? defaultStep}
        onChange={(evt) => this.handleChangeNumber(name, evt)}
        value={value}
      />
    );
  }

  render() {
    const {settingsKey} = this.props;
    const settings = this.getSettings();

    return (
      <div className={`node-properties ${settingsKey}`}>
        {Object.entries(settings).map(([name, value]) => (
          <div className={name} key={name}>
            <label>{label(name)}</label>
            {this.renderSetting(name, value)}
          </div>
        ))}
      </div>
    );
  }
}
