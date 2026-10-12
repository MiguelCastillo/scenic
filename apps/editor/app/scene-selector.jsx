import * as React from "react";

export class SceneSelector extends React.Component {
  render() {
    const {sceneFiles, onSelect, onCancel} = this.props;

    return (
      <div className="scene-selector">
        <div className="scene-selector-header">Select a scene</div>
        <ul className="scene-selector-list">
          {sceneFiles.map((sceneFile) => (
            <li key={sceneFile}>
              <button onClick={() => onSelect(sceneFile)}>{sceneFile}</button>
            </li>
          ))}
        </ul>
        {onCancel ? (
          <button className="scene-selector-cancel" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    );
  }
}
