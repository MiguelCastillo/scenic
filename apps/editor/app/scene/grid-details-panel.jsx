import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {SettingsProperties} from "./settings-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {ScriptProperties, useScriptTab} from "./script-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// Grid settings are in scene units and whole lines, except line width, which
// is in pixels and can be fractional.
const gridSteps = {lineWidth: 0.5};

// GridDetailsPanel shows a grid's settings, such as its spacing and fill, and
// its line color as its material.
export const GridDetailsPanel = (props) => {
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
    case "grid":
      children = (
        <SettingsProperties node={node} settingsKey="grid" steps={gridSteps} defaultStep={1} />
      );
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
          tabs={["info-details", "transform", "grid", "material", scriptTab]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
