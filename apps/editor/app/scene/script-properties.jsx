import * as React from "react";

import {SceneContext} from "./scene-context.js";
import {WithNodeState} from "./with-node-state.jsx";

// useScriptTab is the "script" tab for a details panel's toolbar when node
// runs a script, and null otherwise, which the toolbar leaves out.
export function useScriptTab(node) {
  const {sceneManager} = React.useContext(SceneContext);
  return sceneManager.getNodeStateByID(node.id)?.script ? "script" : null;
}

// stepFor is how much a number setting's arrows change it: whole steps for
// whole numbers of 10 or more, such as a radius, and small steps otherwise,
// such as a throttle.
const stepFor = (value) => (Number.isInteger(value) && Math.abs(value) >= 10 ? 1 : 0.05);

// ScriptProperties shows the script a node runs and edits its settings.
// Scripts read their settings from the node's state every frame, so changes
// show up live. Numbers, on/off settings, and text can be edited; anything
// else, such as a list, is shown as it is.
export class ScriptProperties extends WithNodeState {
  updateSetting = (name, value) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      script: {
        ...nodeState.script,
        settings: {...nodeState.script.settings, [name]: value},
      },
    });
  };

  handleChangeNumber = (name, evt) => {
    const value = parseFloat(evt.target.value);
    // Leave the setting alone while what is typed is not a number yet, such
    // as a lone "-".
    if (!Number.isNaN(value)) {
      this.updateSetting(name, value);
    }
  };

  renderSetting(name, value) {
    if (typeof value === "number") {
      return (
        <input
          type="number"
          step={stepFor(value)}
          onChange={(evt) => this.handleChangeNumber(name, evt)}
          value={value}
        />
      );
    }
    if (typeof value === "boolean") {
      return (
        <input
          type="checkbox"
          onChange={(evt) => this.updateSetting(name, evt.target.checked)}
          checked={value}
        />
      );
    }
    if (typeof value === "string") {
      return (
        <input
          type="text"
          onChange={(evt) => this.updateSetting(name, evt.target.value)}
          value={value}
        />
      );
    }
    return <input readOnly type="text" value={JSON.stringify(value)} />;
  }

  render() {
    const {script} = this.getNodeState();
    if (!script) {
      return null;
    }

    const settings = script.settings || {};

    return (
      <div className="node-properties script">
        <div className="src">
          <label>Script</label>
          <input readOnly type="text" value={script.src} />
        </div>
        {Object.entries(settings).map(([name, value]) => (
          <div className={`setting ${name}`} key={name}>
            <label>{name}</label>
            {this.renderSetting(name, value)}
          </div>
        ))}
      </div>
    );
  }
}
