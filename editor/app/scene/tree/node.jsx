import * as React from "react";

import {SceneNodeContent} from "./node-content.jsx";
import {SceneNodeMesh} from "./node-static-mesh.jsx";
import {SceneNodeLight} from "./node-light.jsx";
import {NodeSelectionContext} from "./selection-context.js";

export class SceneNodeCollection extends React.Component {
  render() {
    const {items} = this.props;

    return (
      <ul className="scene-nodes">
        {items.map(item => <SceneNode key={item.name} node={item} />)}
      </ul>
    );
  }
}

export class SceneNode extends React.Component {
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
    const {node} = this.props;
    const {name, type, items=[]} = node;

    const {collapsed} = this.state;
    const className=["scene-node", type];

    if (collapsed) {
      className.push("collapsed");
    }

    if (type === "static-mesh") {
      return <SceneNodeMesh node={node}/>
    }
    else if (type === "light") {
      return <SceneNodeLight node={node}/>
    }
    else {
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
}
