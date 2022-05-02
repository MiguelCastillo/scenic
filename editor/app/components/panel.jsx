import * as React from "react";
import {classNames} from "./css.js";

import "./panel.css";

export const PanelHeader = (props) => {
  const {style={}, className, children} = props;
  return (
    <div
      className={classNames(["panel-header", className])}
      style={style}
    >
      {children}
    </div>
  );
};

export const PanelBody = (props) => {
  const {style={}, className, children} = props;
  return (
    <div
      className={classNames(["panel-body", className])}
      style={style}
    >
      {children}
    </div>
  );
};

export const Panel = (props) => {
  const {style={}, className, children} = props;
  return (
    <div
      className={classNames(["panel", className])}
      style={style}
    >
      {children}
    </div>
  );
};
