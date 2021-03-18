import * as React from "react";

export class Loading extends React.Component {
  render() {
    const {isLoading} = this.props;
    const classNames = ["loading"];

    if (isLoading) {
      classNames.push("active");
    }

    return (
      <div className={classNames.join(" ")}>
        <div className="message">
          Loading
          <div className="dots">
            <div className="dot-1">.</div>
            <div className="dot-2">.</div>
            <div className="dot-3">.</div>
          </div>
        </div>
      </div>
    );
  }
}
