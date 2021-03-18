import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";

export class StaticMeshDetailsPanel extends React.Component {
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
    const materialClassNames = ["selected"].filter(_ => "material" === selectedView).concat(["button", "material"]).join(" ");

    let children = null;
    switch (selectedView) {
      case "transform":
        children = <TransformProperties node={node} />;
        break;
      case "material":
        children = <MaterialProperties node={node} />;
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
            <a className={materialClassNames} onClick={() => this.handleViewSelection("material")}>M</a>
          </div>
          <div className="scene-node-details-content">
            {children}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
