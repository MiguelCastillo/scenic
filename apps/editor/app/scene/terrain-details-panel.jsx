import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {SettingsProperties} from "./settings-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {ScriptProperties, useScriptTab} from "./script-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// Terrain settings are in scene units, in steps big enough to see, except
// the seed and detail, which are whole numbers, and flatness, which is 0 to 1.
const terrainSteps = {seed: 1, height: 10, scale: 100, flatness: 0.05, tileSize: 100, detail: 1};

// TerrainDetailsPanel shows a terrain's settings, such as how tall and far
// apart its hills are, and its material.
export const TerrainDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("info-details");
  const {node} = props;
  const scriptTab = useScriptTab(node);

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "transform":
      children = <TransformProperties node={node} />;
      break;
    case "terrain":
      children = <SettingsProperties node={node} settingsKey="terrain" steps={terrainSteps} />;
      break;
    case "material":
      children = <MaterialProperties node={node} />;
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
          tabs={["info-details", "transform", "terrain", "material", scriptTab]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
