import * as React from "react"

import {SceneContext} from "./scene-context.js";

export class WithNodeState extends React.Component {
  static contextType = SceneContext;

  getNodeState = () => {
    const {node} = this.props;
    return this.context.stateManager.getItemByName(node.name);
  }

  updateNodeState = (data) => {
    const nodeState = this.getNodeState();
    this.context.stateManager.updateItemByName(nodeState.name, data);
    this.forceUpdate();
  }
}
