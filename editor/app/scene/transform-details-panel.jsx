import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";

export class TransformDetailsPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedView: "transform",
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
    const transformClassNames = ["selected"].filter(_ => "transform" === selectedView).concat(["button", "transform"]).join(" ");

    let children = null;
    switch (selectedView) {
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
