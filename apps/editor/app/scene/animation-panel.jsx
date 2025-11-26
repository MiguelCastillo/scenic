import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

export const AnimationPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("animation");
  const {node} = props;

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "animation":
      children = <AnimationProperties node={node} />;
      break;
  }

  return (
    <Panel>
      <PanelHeader className="scene-node-details-header">
        <div>{selectedView}</div>
        <div>{node.name}</div>
      </PanelHeader>
      <PanelBody>
        <PanelToolbar
          tabs={["info-details", "animation"]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
