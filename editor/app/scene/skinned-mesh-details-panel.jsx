import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";
import {PanelToolbar} from "./panel-toolbar.jsx";

export class SkinnedMeshDetailsPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedView: "animation",
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

    const hasAnimation = node.animation && node.animation.type === "animation";
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
      case "animation":
        if (hasAnimation) {
          children = <AnimationProperties node={node.animation} />;
        }
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
            tabs={["info-details", "transform", "material", hasAnimation ? "animation" : null]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </div>
      </React.Fragment>
    );
  }
}
