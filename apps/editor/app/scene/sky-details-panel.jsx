import * as React from "react";
import {SettingsProperties} from "./settings-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {ScriptProperties, useScriptTab} from "./script-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// SkyDetailsPanel shows a sky's settings, such as its colors, clouds, and
// mountains.
// Settings in degrees change a degree at a time, so does cloudStyle, which is
// 0 to 4, and the rest in small steps.
const skySteps = {sunElevation: 1, sunAzimuth: 1, mountainHeight: 1, cloudStyle: 1};

export const SkyDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("info-details");
  const {node} = props;
  const scriptTab = useScriptTab(node);

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "sky":
      children = <SettingsProperties node={node} settingsKey="sky" steps={skySteps} />;
      break;
    case "script":
      children = <ScriptProperties node={node} />;
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
          tabs={["info-details", "sky", scriptTab]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
