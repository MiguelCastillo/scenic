import * as React from "react";

import {SceneNodeCollection} from "./node.jsx";
import {SceneNodeContent} from "./node-content.jsx";
import {NodeSelectionContext} from "./selection-context.js";

export class SceneNodeLight extends React.Component {
  static contextType = NodeSelectionContext;

  constructor() {
    super();
    this.state = {
      collapsed: false,
    };
  }

  handlerExpanderClick = () => {
    const {collapsed} = this.state;
    this.setState({collapsed: !collapsed})
  }

  handleNameClick = () => {
    this.context.handleNodeSelection(this.props.node);
  }

  render() {
    const {node: {name, items=[]}} = this.props;
    const {collapsed} = this.state;
    const className=["scene-node", "scene-node-light"];

    if (collapsed) {
      className.push("collapsed");
    }

    const isEmpty = items.length === 0;
    if (isEmpty) {
      className.push("empty");
    }

    return (
      <li className={className.join(" ")}>
        <SceneNodeContent
          name={name}
          handlerExpanderClick={this.handlerExpanderClick}
          handleNameClick={this.handleNameClick}
        />
        <SceneNodeCollection items={items} />
      </li>
    );
  }
}
