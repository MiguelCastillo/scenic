import * as React from "react";
import {TransformProperties} from "./transform-properties.jsx";
import {MaterialProperties} from "./material-properties.jsx";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";

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
  }

  render() {
    const {node} = this.props;
    const {selectedView} = this.state;
    const infoDetailsClassNames = ["selected"].filter(_ => "info-details" === selectedView).concat(["button", "info-details"]).join(" ");
    const transformClassNames = ["selected"].filter(_ => "transform" === selectedView).concat(["button", "transform"]).join(" ");
    const materialClassNames = ["selected"].filter(_ => "material" === selectedView).concat(["button", "material"]).join(" ");
    const animationClassNames = ["selected"].filter(_ => "animation" === selectedView).concat(["button", "animation"]).join(" ");

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
          <div>{selectedView}</div><div>{node.name}</div>
        </div>
        <div className="scene-node-details-body">
          <div className="scene-node-details-toolbar">
            <a className={infoDetailsClassNames} onClick={() => this.handleViewSelection("info-details")}>I</a>
            <a className={transformClassNames} onClick={() => this.handleViewSelection("transform")}>T</a>
            <a className={materialClassNames} onClick={() => this.handleViewSelection("material")}>M</a>
            {hasAnimation ?
              <a className={animationClassNames} onClick={() => this.handleViewSelection("animation")}>A</a> : null
            }
          </div>
          <div className="scene-node-details-content">
            {children}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
