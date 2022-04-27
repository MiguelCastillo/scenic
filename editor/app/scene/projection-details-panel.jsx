import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {TransformProperties} from "./transform-properties.jsx";
import {OrthographicProjectionProperties} from "./othographic-projection-properties.jsx";
import {PerspectiveProjectionProperties} from "./perspective-projection-properties.jsx";
import {PanelToolbar} from "./panel-toolbar.jsx";

export class ProjectionDetailsPanel extends React.Component {
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
      case "projection":
        if (node.type === "perspective") {
          children = <PerspectiveProjectionProperties node={node} />;
        } else if (node.type === "orthographic") {
          children = <OrthographicProjectionProperties node={node} />;
        }
        break;
      case "orthographic":
        break;
      case "transform":
        children = <TransformProperties node={node} />;
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
            tabs={["info-details", "projection", "transform"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </div>
      </React.Fragment>
    );
  }
}
