import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {PanelToolbar} from "../components/panel-toolbar.jsx";
import {Panel, PanelHeader, PanelBody} from "../components/panel.jsx";

export class TransformDetailsPanel extends React.Component {
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
    }

    return (
      <Panel>
        <PanelHeader className="scene-node-details-header">
          <div>{selectedView}</div>
          <div>{node.name}</div>
        </PanelHeader>
        <PanelBody className="scene-node-details-body">
          <PanelToolbar
            tabs={["info-details", "transform"]}
            onTabSelected={this.handleViewSelection}
            selectedTab={selectedView}
          />
          <div className="scene-node-details-content">{children}</div>
        </PanelBody>
      </Panel>
    );
  }
}
