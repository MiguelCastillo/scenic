import * as React from "react";
import {buildStyles, buildClassNames} from "./utils.js";

export const PanelHeader = (props) => {
  const {style, className, children} = props;
  return (
    <div
      className={buildClassNames(["panel-header", className])}
      style={buildStyles([styles.panelHeader, style])}
    >
      {children}
    </div>
  );
};

export const PanelBody = (props) => {
  const {style, className, children} = props;
  return (
    <div
      className={buildClassNames(["panel-body", className])}
      style={buildStyles([styles.panelBody, style])}
    >
      {children}
    </div>
  );
};

export const Panel = (props) => {
  const {style, className, children} = props;
  return (
    <div
      className={buildClassNames(["panel", className])}
      style={buildStyles([styles.panel, style])}
    >
      {children}
    </div>
  );
};

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
  },
  panelBody: {
    display: "flex",
  }
}
