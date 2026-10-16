import * as React from "react";
import {SettingsProperties} from "./settings-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {ScriptProperties, useScriptTab} from "./script-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// Forest settings are in scene units, in steps big enough to see, except the
// seed, which is a whole number, and tree sizes, which are scales.
const forestSteps = {seed: 1, density: 1, distance: 500, margin: 50, tileSize: 100};

// ForestDetailsPanel shows a forest's settings, such as how many trees grow
// and how far away they reach. Its kinds of tree are its children.
export const ForestDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("info-details");
  const {node} = props;
  const scriptTab = useScriptTab(node);

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "forest":
      children = <SettingsProperties node={node} settingsKey="forest" steps={forestSteps} />;
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
      <PanelBody className="scene-node-details-body">
        <PanelToolbar
          tabs={["info-details", "forest", scriptTab]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
