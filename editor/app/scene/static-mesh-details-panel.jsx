import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

export class StaticMeshDetailsPanel extends React.Component {
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
    }

    return (
      <Panel>
        <PanelHeader className="scene-node-details-header">
          <div>{selectedView}</div>
          <div>{node.name}</div>
        </PanelHeader>
        <PanelBody>
          <PanelToolbar
            tabs={["info-details", "transform", "material"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </PanelBody>
      </Panel>
    );
  }
}
