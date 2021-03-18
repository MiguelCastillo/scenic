import * as React from "react";

import {NodeSelectionContext} from "./selection-context.js";

export class SceneNodeContent extends React.Component {
  static contextType = NodeSelectionContext;

  render() {
    const {selectedNode} = this.context;
    const {name, handlerExpanderClick, handleNameClick} = this.props;
    const classNames = ["scene-node-content"].concat(selectedNode && selectedNode.name === name ? "selected" : "");

    return (
      <div className={classNames.join(" ")}>
        <div className="expander" onClick={() => handlerExpanderClick()}></div>
        <div className="name" onClick={() => handleNameClick()}>{name}</div>
      </div>
    );
  }
}
