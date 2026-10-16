import * as React from "react";
import {AnimationPanel} from "./scene/animation-panel.jsx";
import {StaticMeshDetailsPanel} from "./scene/static-mesh-details-panel.jsx";
import {SkinnedMeshDetailsPanel} from "./scene/skinned-mesh-details-panel.jsx";
import {LightDetailsPanel} from "./scene/light-details-panel.jsx";
import {TransformDetailsPanel} from "./scene/transform-details-panel.jsx";
import {CameraDetailsPanel} from "./scene/camera-details-panel.jsx";
import {MaterialDetailsPanel} from "./scene/material-details-panel.jsx";
import {ViewportDetailsPanel} from "./scene/viewport-details-panel.jsx";
import {SkyDetailsPanel} from "./scene/sky-details-panel.jsx";
import {GridDetailsPanel} from "./scene/grid-details-panel.jsx";
import {TerrainDetailsPanel} from "./scene/terrain-details-panel.jsx";
import {ForestDetailsPanel} from "./scene/forest-details-panel.jsx";

export class NodeDetailsPanel extends React.Component {
  render() {
    const {node} = this.props;

    if (!node) {
      return null;
    }

    let children = null;
    switch (node.type) {
      case "camera":
      case "free-fly-camera":
      case "first-person-camera":
      case "third-person-camera":
        children = <CameraDetailsPanel node={node} />;
        break;
      case "static-mesh":
        children = <StaticMeshDetailsPanel node={node} />;
        break;
      case "skinned-mesh":
        children = <SkinnedMeshDetailsPanel node={node} />;
        break;
      case "light":
        children = <LightDetailsPanel node={node} />;
        break;
      case "transform":
        children = <TransformDetailsPanel node={node} />;
        break;
      case "grid":
        children = <GridDetailsPanel node={node} />;
        break;
      case "animation":
        children = <AnimationPanel node={node} />;
        break;
      case "sky":
        children = <SkyDetailsPanel node={node} />;
        break;
      case "terrain":
        children = <TerrainDetailsPanel node={node} />;
        break;
      case "forest":
        children = <ForestDetailsPanel node={node} />;
        break;
      case "viewport":
        children = <ViewportDetailsPanel node={node} />;
        break;
      case "material":
        children = <MaterialDetailsPanel node={node}/>;
        break;
      default:
        return null;
    }

    return <div className="scene-node-details">{children}</div>;
  }
}
