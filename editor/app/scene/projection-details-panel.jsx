import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {TransformProperties} from "./transform-properties.jsx";
import {OrthographicProjectionProperties} from "./othographic-projection-properties.jsx";
import {PerspectiveProjectionProperties} from "./perspective-projection-properties.jsx";

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
  }

  render() {
    const {node} = this.props;
    const {selectedView} = this.state;
    const infoDetailsClassNames = ["selected"].filter(_ => "info-details" === selectedView).concat(["button", "info-details"]).join(" ");
    const transformClassNames = ["selected"].filter(_ => "transform" === selectedView).concat(["button", "transform"]).join(" ");
    const projectionClassNames = ["selected"].filter(_ => "projection" === selectedView).concat(["button", "projection"]).join(" ");

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
          <div>{selectedView}</div><div>{node.name}</div>
        </div>
        <div className="scene-node-details-body">
          <div className="scene-node-details-toolbar">
            <a className={infoDetailsClassNames} onClick={() => this.handleViewSelection("info-details")}>I</a>
            <a className={projectionClassNames} onClick={() => this.handleViewSelection("projection")}>P</a>
            <a className={transformClassNames} onClick={() => this.handleViewSelection("transform")}>T</a>
          </div>
          <div className="scene-node-details-content">
            {children}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
