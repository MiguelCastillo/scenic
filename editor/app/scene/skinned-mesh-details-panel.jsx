import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

export const SkinnedMeshDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("animation");
  const {node} = props;

  const hasAnimation = node.animation && node.animation.type === "animation";
  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "transform":
      children = <TransformProperties node={node} />;
      break;
    case "material":
      children = <MaterialProperties node={node} />;
      break;
    case "animation":
      if (hasAnimation) {
        children = <AnimationProperties node={node.animation} />;
      }
      break;
  }

  return (
    <Panel>
      <PanelHeader className="scene-node-details-header">
        <div>{selectedView}</div>
        <div>{node.name}</div>
      </PanelHeader>
      <PanelBody className="scene-node-details-body">
        <PanelToolbar
          tabs={["info-details", "transform", "material", hasAnimation && "animation"]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
