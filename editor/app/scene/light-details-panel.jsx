import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {LightProperties} from "./light-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";

export class LightDetailsPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedView: "info-details",
    };
  }

  handleViewSelection = (selectedView) => {
    this.setState({
      selectedView,
    });
  };

  render() {
    const {node} = this.props;
    const {selectedView} = this.state;

    let children = null;
    switch (selectedView) {
      case "info-details":
        children = <InfoDetailsProperties node={node} />;
        break;
      case "transform":
        children = <TransformProperties node={node} />;
        break;
      case "material":
        children = <MaterialProperties node={node} />;
        break;
      case "light":
        children = <LightProperties node={node} />;
        break;
    }

    return (
      <React.Fragment>
        <div className="scene-node-details-header">
          <div>{selectedView}</div>
          <div>{node.name}</div>
        </div>
        <div className="scene-node-details-body">
          <PanelToolbar
            tabs={["info-details", "transform", "material", "light"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </div>
      </React.Fragment>
    );
  }
}
