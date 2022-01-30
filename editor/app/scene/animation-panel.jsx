import * as React from "react";
import {InfoDetailsProperties} from "./info-details-properties.jsx";
import {AnimationProperties} from "./animation-properties.jsx";

export class AnimationPanel extends React.Component {
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
    const animationClassNames = ["selected"].filter(_ => "animation" === selectedView).concat(["button", "animation"]).join(" ");

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
          <div>{selectedView}</div><div>{node.name}</div>
        </div>
        <div className="scene-node-details-body">
          <div className="scene-node-details-toolbar">
            <a className={infoDetailsClassNames} onClick={() => this.handleViewSelection("info-details")}>I</a>
            <a className={animationClassNames} onClick={() => this.handleViewSelection("animation")}>A</a>
          </div>
          <div className="scene-node-details-content">
            {children}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
