import * as React from "react";

import {SceneNodeCollection} from "./scene/tree/node.jsx";
import {NodeDetailsPanel} from "./node-details-panel.jsx";
import {NodeSelectionContext} from "./scene/tree/selection-context.js";
import {SceneContext} from "./scene/scene-context.js";

export class SceneGraph extends React.Component {
  constructor() {
    super();

    this.state = {
      selectedNode: null,
    };
  }

  handleNodeSelection = (node) => {
    this.setState({
      selectedNode: node,
    });
  }

  handleSceneUpdate = (/*node*/) => {
    this.forceUpdate();
  }

  render() {
    const {
      sceneManager,
      stateManager,
      resourceLoader,
      refreshProjection,
    } = this.props;
    const {selectedNode} = this.state;

    const nodeSelectionContext = {
      handleNodeSelection: this.handleNodeSelection,
      selectedNode,
    };

    const sceneContext = {
      updateScene: this.handleSceneUpdate,
      resourceLoader,
      refreshProjection,
      stateManager,
      sceneManager,
    };

    return (
      <NodeSelectionContext.Provider value={nodeSelectionContext}>
        <SceneContext.Provider value={sceneContext}>
          <div className="scene-graph">
            <div className="scene-tree">
              <div className="scene-tree-header">Scene Graph</div>
              <SceneNodeCollection nodes={sceneManager.rootNodes} />
            </div>
            {this.state.selectedNode ? <NodeDetailsPanel node={this.state.selectedNode} /> : null}            
          </div>
        </SceneContext.Provider>
      </NodeSelectionContext.Provider>
    );
  }
}
