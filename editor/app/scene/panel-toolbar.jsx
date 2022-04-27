import * as React from "react";

import {
  Axes,
  InfoEmpty,
  Keyframes,
  PerspectiveView,
  SunLight,
  Svg3DSelectFace,
} from "iconoir-react";

/**
 * Maps the tab id to a set of properties to display.
 * @param {Tab} tab
 *
 * @returns An object with the properties to display.
 */
function getTabDetails(tab) {
  switch (tab) {
    case "info-details":
      return {icon: InfoEmpty, label: "Info & Details"};
    case "transform":
      return {icon: Axes, label: "Transform"};
    case "material":
      return {icon: Svg3DSelectFace, label: "Material"};
    case "animation":
      return {icon: Keyframes, label: "Animation"};
    case "projection":
      return {icon: PerspectiveView, label: "Projection"};
    case "light":
      return {icon: SunLight, label: "Light"};
  }
}

/**
 * The tabs to display in the details panel.
 */
export function PanelToolbar({tabs, selectedTab, onTabSelected}) {
  return (
    <div className="scene-node-details-toolbar">
      {tabs.filter(Boolean).map((tab) => {
        const classNames = ["selected"]
          .filter((_) => tab === selectedTab)
          .concat(["button", tab])
          .join(" ");

        const {icon: TabIcon, label} = getTabDetails(tab);

        return (
          <button
            aria-label={label}
            className={classNames}
            onClick={() => onTabSelected(tab)}
            key={tab}
          >
            <TabIcon />
          </button>
        );
      })}
    </div>
  );
}
