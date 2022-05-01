import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";

export class AnimationPanel extends React.Component {
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

    let children = null;
    switch (selectedView) {
      case "info-details":
        children = <InfoDetailsProperties node={node} />;
        break;
      case "animation":
        children = <AnimationProperties node={node} />;
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
            tabs={["info-details", "animation"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />

          <div className="scene-node-details-content">{children}</div>
        </div>
      </React.Fragment>
    );
  }
}
