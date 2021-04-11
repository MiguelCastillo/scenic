import * as React from "react";
import {StaticMeshDetailsPanel} from "./scene/static-mesh-details-panel.jsx";
import {LightDetailsPanel} from "./scene/light-details-panel.jsx";
import {TransformDetailsPanel} from "./scene/transform-details-panel.jsx";
import {ProjectionDetailsPanel} from "./scene/projection-details-panel.jsx";

export class NodeDetailsPanel extends React.Component {
  render() {
    const {node} = this.props;

    if (!node) {
      return null;
    }

    let children = null;
    switch(node.type) {
      case "perspective":
      case "orthographic":
        children = <ProjectionDetailsPanel node={node} />;
        break;
      case "static-mesh":
        children = <StaticMeshDetailsPanel node={node} />;
        break;
      case "light":
        children = <LightDetailsPanel node={node} />;
        break;
      case "transform":
        children = <TransformDetailsPanel node={node} />;
        break;
    }

    return (
      <div className="scene-node-details">
        {children}
      </div>
    );
  }
}
