import * as React from "react";

import {SceneContext} from "./scene-context.js";

export class WithNodeState extends React.Component {
  static contextType = SceneContext;

  getNodeState = () => {
    const {node} = this.props;
    return this.context.sceneManager.getNodeStateByID(node.id);
  };

  updateNodeState = (data) => {
    const {node} = this.props;
    this.context.sceneManager.updateNodeStateByID(node.id, data);
    this.forceUpdate();
  };
}
