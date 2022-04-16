import * as React from "react";

export class Console extends React.Component {
  render() {
    const {buffer} = this.props;

    return (
      <div className="console">
        {buffer.map(([type, /*date*/, ...msg], i) => {
          return (
            <div key={`console-${i}`} className={`console-${type}`}>
              {type} {msg.join(" ")}
            </div>
          );
        })}
      </div>
    );
  }
}
