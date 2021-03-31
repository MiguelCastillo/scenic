import * as React from "react";

import {SceneContext} from "./scene-context.js";

export class InfoDetailsProperties extends React.Component {
  static contextType = SceneContext;

  handleResourceSelection = (evt) => {
    if (evt.target.files.length === 0) {
      return;
    }

    const {
      resourceLoader,
      updateScene,
    } = this.context;

    const {
      node,
    } = this.props;

    // The input element is not configured to multiselect, so this should
    // always be 1 file.
    const [file] = evt.target.files;

    resourceLoader.load({
      node,
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
    node.resource = file.name;
    this.forceUpdate();

    // Trigger scene update so that the scene tree is re-rendered.
    updateScene(node);
  }

  handleChange = (which, evt) => {
    const {node} = this.props;
    node[which] = evt.target.value;
    this.forceUpdate();
    this.context.updateScene(node);
  }

  render() {
    const {node} = this.props;
    return (
      <div className="node-properties info-details">
        <div className="name">
          <label>Name</label>
          <input
            type="text"
            onChange={(evt) => this.handleChange("name", evt)}
            value={node.name} />
        </div>
        <div className="type">
          <label>Type</label>
          <input
            readOnly
            type="text"
            onChange={(evt) => this.handleChange("type", evt)}
            value={node.type} />
        </div>
        {(node.type === "static-mesh" || node.type === "light") ?
          <div className="resource">
            <label>Resource</label>
            <div className="resource-selector">
              <div className="selected-file">{
                (
                  node.resource ?
                  node.resource.split(/[/\\]/).pop() :
                  "<select file>"
                )}</div>
              <button className="dialog-openener">
                <label htmlFor="resource_file_loader">...</label>
              </button>
              <input
                id="resource_file_loader"
                name="resource_file_loader"
                type="file"
                accept=".obj"
                onChange={(evt) => this.handleResourceSelection(evt)} />
            </div>
          </div>
          : null
       }
      </div>
    );
  }
}