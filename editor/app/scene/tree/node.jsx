import * as React from "react";

import {SceneNodeContent} from "./node-content.jsx";
import {SceneNodeStaticMesh} from "./node-static-mesh.jsx";
import {SceneNodeSkinnedMesh} from "./node-skinned-mesh.jsx";
import {SceneNodeLight} from "./node-light.jsx";
import {NodeSelectionContext} from "./selection-context.js";

export class SceneNodeCollection extends React.Component {
  render() {
    const {nodes} = this.props;

    return (
      <ul className="scene-nodes">
        {nodes.map(node => <SceneNode key={node.id} node={node} />)}
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
      return <SceneNodeStaticMesh node={node}/>;
    } else if (type === "skinned-mesh") {
      return <SceneNodeSkinnedMesh node={node}/>;
    } else if (type === "light") {
      return <SceneNodeLight node={node}/>;
    } else {
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
          <SceneNodeCollection nodes={items} />
        </li>
      );
    }
  }
}
