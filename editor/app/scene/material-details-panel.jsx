import * as React from "react";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";

export class MaterialDetailsPanel extends React.Component {
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
      case "material": {
        children = <MaterialProperties node={node} />;
        break;
      }
      default:
        return null;
    }

    return (
      <React.Fragment>
        <div className="scene-node-details-header">
          <div>{selectedView}</div>
          <div>{node.name}</div>
        </div>
        <div className="scene-node-details-body">
          <PanelToolbar
            tabs={["info-details", "material"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </div>
      </React.Fragment>
    );
  }
}
