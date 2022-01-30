import * as React from "react";
import {WithNodeState} from "./with-node-state.jsx";

export class InfoDetailsProperties extends WithNodeState {
  handleResourceSelection = (evt) => {
    if (evt.target.files.length === 0) {
      return;
    }

    const {
      resourceLoader,
      updateScene,
    } = this.context;

    const nodeState = this.getNodeState();

    // The input element is not configured to multiselect, so this should
    // always be 1 file.
    const [file] = evt.target.files;

    resourceLoader.load({
      node: nodeState,
      url: URL.createObjectURL(file),
      filename: file.name,
    })
    .then(() => {
      // Clean up URL resource because this will stay in memory until the
      // document is reloaded. And new URL object are instantiated each time
      // createObjectURL is called, even if it's for the same resource.
      URL.revokeObjectURL(file);
    });

    // HACK(miguel): we need a better way to set the resource name for
    // display purposes.
    this.updateNodeState({
      ...nodeState,
      resource: evt.target.value,
    });

    // Trigger scene update so that the scene tree is re-rendered.
    updateScene();
  }

  handleChange = (which, evt) => {
    const nodeState = this.getNodeState();

    this.updateNodeState({
      ...nodeState,
      [which]: evt.target.value,
    });

    this.context.updateScene();
  }

  render() {
    const nodeState = this.getNodeState();

    return (
      <div className="node-properties info-details">
        <div className="name">
          <label>Name</label>
          <input
            type="text"
            onChange={(evt) => this.handleChange("name", evt)}
            value={nodeState.name} />
        </div>
        <div className="type">
          <label>Type</label>
          <input
            readOnly
            type="text"
            onChange={(evt) => this.handleChange("type", evt)}
            value={nodeState.type} />
        </div>
        {(nodeState.type === "static-mesh" || nodeState.type === "light") ?
          <div className="resource">
            <label>Resource</label>
            <div className="resource-selector">
              <div className="selected-file">{
                (
                  nodeState.resource ?
                  nodeState.resource.split(/[/\\]/).pop() :
                  "<select file>"
                )}</div>
              <button className="dialog-openener">
                <label htmlFor="resource_file_loader">...</label>
              </button>
              <input
                id="resource_file_loader"
                name="resource_file_loader"
                type="file"
                accept=".obj,.fbx"
                onChange={(evt) => this.handleResourceSelection(evt)} />
            </div>
          </div>
          : null
       }
      </div>
    );
  }
}