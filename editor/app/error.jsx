import * as React from "react";

export class Error extends React.Component {
  render() {
    const {error} = this.props;
    return (
      <div className="error">
        <h1 className="message">
          {error.toString()}
        </h1>
        <div className="stack">
          {error.stack.split("\n").map((l) => {
            return <div className="line">{l}</div>
          })}
        </div>
      </div>
    );
  }
}
