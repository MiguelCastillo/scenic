import * as React from "react";

import {SceneNodeCollection} from "./scene/tree/node.jsx";
import {NodeDetailsPanel} from "./node-details-panel.jsx";
import {NodeSelectionContext} from "./scene/tree/selection-context.js";

export class SceneGraph extends React.Component {
  constructor() {
    super();

    this.state = {
      selectedNode: null,
    };
  }

  handleNodeSelection = (node) => {
    this.setState({
      selectedNode: node
    });
  }

  render() {
    const {stateManager} = this.props;
    const {selectedNode} = this.state;

    return (
      <NodeSelectionContext.Provider value={{handleNodeSelection: this.handleNodeSelection, selectedNode}}>
        <div className="scene-graph">
          <div className="scene-tree">
            <div className="scene-tree-header">Scene Graph</div>
            <SceneNodeCollection items={stateManager.getItems()} />
          </div>
          {this.state.selectedNode ? <NodeDetailsPanel node={this.state.selectedNode} /> : null}            
        </div>
      </NodeSelectionContext.Provider>
    );
  }
}
