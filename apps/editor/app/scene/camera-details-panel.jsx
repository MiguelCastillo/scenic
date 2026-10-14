import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {ScriptProperties, useScriptTab} from "./script-properties.jsx";
import {TransformProperties} from "./transform-properties.jsx";
import {OrthographicProjectionProperties} from "./othographic-projection-properties.jsx";
import {PerspectiveProjectionProperties} from "./perspective-projection-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {SceneContext} from "./scene-context.js";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

import "./scene-node-details.css";

// CameraDetailsPanel shows a camera's lens (its projection) and its transform.
export const CameraDetailsPanel = (props) => {
  const [selectedView, setSelectedView] = React.useState("info-details");
  const {sceneManager} = React.useContext(SceneContext);
  const {node} = props;
  const scriptTab = useScriptTab(node);
  const projectionType = sceneManager.getNodeStateByID(node.id).projection.type;

  let children = null;
  switch (selectedView) {
    case "info-details":
      children = <InfoDetailsProperties node={node} />;
      break;
    case "projection":
      if (projectionType === "perspective") {
        children = <PerspectiveProjectionProperties node={node} />;
      } else if (projectionType === "orthographic") {
        children = <OrthographicProjectionProperties node={node} />;
      }
      break;
    case "orthographic":
      break;
    case "transform":
      children = <TransformProperties node={node} />;
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
          tabs={["info-details", "projection", "transform", scriptTab]}
          onTabSelected={setSelectedView}
          selectedTab={selectedView}
        />
        <div className="scene-node-details-content">{children}</div>
      </PanelBody>
    </Panel>
  );
};
