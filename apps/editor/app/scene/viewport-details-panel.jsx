import * as React from "react";
import {FogProperties} from "./fog-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// ViewportDetailsPanel shows the settings that apply to everything a viewport
// draws, such as its fog.
export const ViewportDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("info-details");
  const {node} = props;

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "fog":
      children = <FogProperties node={node} />;
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
          tabs={["info-details", "fog"]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
