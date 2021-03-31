import * as React from "react";

import {SceneUpdateContext} from "./scene-update-context.js";

export class InfoDetailsProperties extends React.Component {
  static contextType = SceneUpdateContext;

  handleResourceSelection = (evt) => {
    if (evt.target.files.length === 0) {
      return;
    }

    const [file] = evt.target.files;

    /*
    // TODO(miguel): wire this up to the resource loader.
    const url = URL.createObjectURL(file)
    */

    const {node} = this.props;
    node.resource = file.name;
    this.forceUpdate();
    this.context.updateScene(node);
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