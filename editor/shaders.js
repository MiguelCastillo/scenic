
import {ShaderProgram} from "../src/shaders/program.js";
import {treeGetMatches} from "../src/scene-manager.js";
import {isLight, isStaticMesh} from "./scene-factory.js";

export function createRenderableShaderProgram(gl, lights) {
  const vertShaderCode = `#version 300 es
    in vec4 position;
    in vec4 normal;
    in vec4 color;

    uniform mat4 projectionMatrix;
    uniform mat4 worldMatrix;

    out vec4 fragmentColor;
    out vec4 fragmentNormal;

    void main() {
      mat4 transform = projectionMatrix * worldMatrix;
      gl_Position = transform * position;

      fragmentNormal = worldMatrix * vec4(normal.xyz, 0.0);
      fragmentColor = color;
    }
  `;

  const fragShaderCode = `#version 300 es
    precision highp float;
    out vec4 pixelColor;

    in vec4 fragmentColor;
    in vec4 fragmentNormal;

    uniform vec3 ambientLightColor;
    uniform vec4 materialColor;
    uniform float materialReflectiveness;

    ${declareLights(lights)}

    vec3 calculateDiffuseLight(vec3 normal, vec3 lightPosition, vec3 lightColor, float lightIntensity) {
      if (lightIntensity == 0.0) {
        return vec3(0.0, 0.0, 0.0);
      }

      if (lightColor.r == 0.0 && lightColor.g == 0.0 && lightColor.b == 0.0) {
        return vec3(0.0, 0.0, 0.0);
      }

      return lightColor * lightIntensity * clamp(dot(normal, lightPosition), 0.1, 1.0);
    }

    void main() {
      vec3 calculatedLightColor = ambientLightColor;
      vec3 normal = normalize(fragmentNormal.xyz);

      if (materialReflectiveness != 0.0) {
        calculatedLightColor += ((${processDiffuseLighting(lights)}) * materialReflectiveness);
        // This gives a great blend of CYM colors to generate RGB colors.
        // calculatedLightColor += log2((${processDiffuseLighting(lights)}) * materialReflectiveness);
      }

      pixelColor = fragmentColor + materialColor;
      pixelColor.rgb *= calculatedLightColor.rgb;
    }
  `;

  function declareLights(lights) {
    return lights.map((_, idx) => (
      `uniform vec3 lightColor${idx};uniform vec3 lightPosition${idx};uniform float lightIntensity${idx};`
    )).join(" ");
  }

  function processDiffuseLighting(lights) {
    return lights
      .map((_, idx) => `calculateDiffuseLight(normal, lightPosition${idx}, lightColor${idx}, lightIntensity${idx})`)
      .join(" + ");
  }

  return new ShaderProgram(gl).link(vertShaderCode, fragShaderCode);
}

export function createPointShaderProgram(gl) {
  const vertShaderCode = `#version 300 es
    in vec4 position;
    in vec4 color;

    out vec4 fragmentColor;

    uniform mat4 projectionMatrix;
    uniform mat4 worldMatrix;

    void main() {
      mat4 transform = projectionMatrix * worldMatrix;
      gl_Position = transform * position;
      fragmentColor = color;
    }
  `;

  const fragShaderCode = `#version 300 es
    precision highp float;
    out vec4 pixelColor;
    in vec4 fragmentColor;

    uniform vec4 materialColor;

    void main() {
      pixelColor = fragmentColor + materialColor;
    }
  `;

  return new ShaderProgram(gl).link(vertShaderCode, fragShaderCode);
}

export function createShaderProgramLoader(gl, sceneManager) {
  const renderableShaderProgram = createRenderableShaderProgram(gl, new Array(8).fill(0))
    .addAttributes([
      {
        name: "color",
      }, {
        name: "normal",
      }, {
        name: "position",
      },
    ]);

  const lightSourceProgramShader = createPointShaderProgram(gl)
    .addAttributes([
      {
        name: "color",
      }, {
        name: "position",
      },
    ]);

  function load(node) {
    if (isStaticMesh(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(renderableShaderProgram);
    } else if (isLight(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(lightSourceProgramShader);
    } else {
      throw new Error("Unable to intialize shader program because node is not a static-mesh or light");
    }
  }

  function loadMany(nodes) {
    nodes.forEach(n => load(n));
  }

  return {
    loadMany,
    load,
  }
}

export function getNodesWithShadersFromConfig(config) {
  const traverse = treeGetMatches((item) => (
    isLight(item) || isStaticMesh(item)
  ));

  return traverse(config.items);
}
