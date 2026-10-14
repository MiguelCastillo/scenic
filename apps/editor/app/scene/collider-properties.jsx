import * as React from "react";

import {SceneContext} from "./scene-context.js";
import {SettingsProperties} from "./settings-properties.jsx";

// useColliderTab is the "collider" tab for a details panel's toolbar when
// node has a collider, and null otherwise, which the toolbar leaves out.
export function useColliderTab(node) {
  const {sceneManager} = React.useContext(SceneContext);
  return sceneManager.getNodeStateByID(node.id)?.collider ? "collider" : null;
}

// The sizes colliders have when their state leaves them out (see collision
// in @scenic/scene), so they can be edited even then.
const sizeDefaults = {
  sphere: {radius: 1},
  cylinder: {radius: 1, height: 2},
  cone: {radius: 1, height: 2},
};

// ColliderProperties shows a node's collider shape and edits its size live.
export const ColliderProperties = ({node}) => {
  const {sceneManager} = React.useContext(SceneContext);
  const shape = sceneManager.getNodeStateByID(node.id)?.collider?.shape;
  return (
    <SettingsProperties
      node={node}
      settingsKey="collider"
      defaults={sizeDefaults[shape]}
      defaultStep={1}
    />
  );
};
