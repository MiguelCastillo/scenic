import * as React from "react";
import "./panel-toolbar.css";

import {
  Axes,
  Cloud,
  Code,
  DashboardDots,
  VideoCamera,
  Fog,
  InfoEmpty,
  Keyframes,
  Leaf,
  Map as MapIcon,
  PerspectiveView,
  SunLight,
  Svg3DSelectFace,
  BounceRight,
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
    case "third-person":
      return {icon: VideoCamera, label: "Third person"};
    case "script":
      return {icon: Code, label: "Script"};
    case "collider":
      return {icon: BounceRight, label: "Collider"};
    case "grid":
      return {icon: DashboardDots, label: "Grid"};
    case "sky":
      return {icon: Cloud, label: "Sky"};
    case "terrain":
      return {icon: MapIcon, label: "Terrain"};
    case "forest":
      return {icon: Leaf, label: "Forest"};
    case "fog":
      return {icon: Fog, label: "Fog"};
  }
}

/**
 * The tabs to display in the details panel.
 */
export function PanelToolbar({tabs, selectedTab, onTabSelected}) {
  return (
    <div className="panel-toolbar">
      {tabs.filter(Boolean).map((tab) => {
        const classNames = ["selected"]
          .filter(() => tab === selectedTab)
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
