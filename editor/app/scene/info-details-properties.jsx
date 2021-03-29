import * as React from "react";

export class InfoDetailsProperties extends React.Component {
  handleChange = (which, evt) => {
    const {node} = this.props;
    node[which] = evt.target.value;
    this.forceUpdate();
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
            <input
              type="text"
              onChange={(evt) => this.handleChange("resource", evt)}
              value={node.resource} />
          </div>
          : null
       }
      </div>
    );
  }
}