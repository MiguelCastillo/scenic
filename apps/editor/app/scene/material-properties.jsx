import * as React from "react";
import {ColorChannels} from "./color-channels.jsx";
import {WithNodeState} from "./with-node-state.jsx";

import {float} from "@scenic/math";
import {specularDefaults} from "@scenic/scene";

export class MaterialProperties extends WithNodeState {
  handleChangeColor = (value) => {
    const nodeState = this.getNodeState();
    const {
      material: {color},
    } = nodeState;

    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        // The color selector component does not support selecting alpha
        // channels, so we just copy whatever already in the state.
        color: [...value, color[3]],
      },
    });
  };

  handleChangeAmbientColor = (value) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      ambient: {
        ...nodeState.ambient,
        color: [...value],
      },
    });
  }

  handleChangeReflectiveness = (evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        reflectiveness: float.fixed3f(evt.target.value),
      },
    });
  };

  handleChangeOpacity = (evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        opacity: float.fixed3f(evt.target.value),
      },
    });
  };

  handleChangeSpecular = (which, evt) => {
    const nodeState = this.getNodeState();
    this.updateNodeState({
      ...nodeState,
      material: {
        ...nodeState.material,
        [which]: float.fixed3f(evt.target.value),
      },
    });
  };

  render() {
    const {material, ambient} = this.getNodeState();
    if (!material && !ambient) {
      return null;
    }

    return (
      <div className="node-properties material">
        {material?.color != null ?
          <div className="color">
            <label>Color</label>
            <ColorChannels onChange={this.handleChangeColor} data={material.color} />
          </div> : null}
        {material?.reflectiveness != null ?
          <div className="reflectiveness">
            <label>Reflectiveness</label>
            <input
              type="number"
              step=".1"
              min="0"
              max="1"
              onChange={this.handleChangeReflectiveness}
              value={material.reflectiveness}
            />
          </div> : null}
        {/* Opacity is 1 for a material without its own, which is solid. */}
        {material ?
          <div className="opacity">
            <label>Opacity</label>
            <input
              type="number"
              step=".1"
              min="0"
              max="1"
              onChange={this.handleChangeOpacity}
              value={material.opacity ?? 1}
            />
          </div> : null}
        {/* Specular settings are only shown for lit materials, the ones with
            reflectiveness, since highlights are scaled by it. A material
            without its own settings shows the defaults the mesh draws with. */}
        {material?.reflectiveness != null ?
          <div className="specular">
            <label>Specular</label>
            <input
              type="number"
              step=".1"
              min="0"
              onChange={(evt) => this.handleChangeSpecular("specular", evt)}
              value={material.specular ?? specularDefaults.specular}
            />
          </div> : null}
        {material?.reflectiveness != null ?
          <div className="shininess">
            <label>Shininess</label>
            <input
              type="number"
              step="4"
              min="1"
              onChange={(evt) => this.handleChangeSpecular("shininess", evt)}
              value={material.shininess ?? specularDefaults.shininess}
            />
          </div> : null}
        {ambient?.color != null ?
          <div className="color">
          <label>Ambient Color</label>
          <ColorChannels onChange={this.handleChangeAmbientColor} data={ambient.color} />
        </div> : null}
      </div>
    );
  }
}
