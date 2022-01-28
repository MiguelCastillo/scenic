import React from "react";
import ReactDOM from "react-dom";
import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Loading} from "./app/loading.jsx";
import {onReady} from "../src/dom/ready.js";
import webgl from "../src/webgl.js";

export class App {
  constructor() {
  }

  init() {
    // Let's show our app loading spinner
    ReactDOM.render(
      <Loading isLoading={true}/>,
      document.querySelector("#loading-container"));
  }

  ready({sceneManager, resourceLoader, refreshProjection}) {
    // Let's mount the scene tree viewer
    ReactDOM.render(
      <SceneGraph
        sceneManager={sceneManager}
        resourceLoader={resourceLoader}
        refreshProjection={refreshProjection}
      />,
      document.querySelector("#scene-graph-container"));

    ReactDOM.render(
      <Loading isLoading={false}/>,
      document.querySelector("#loading-container"));
  }

  error(err) {
    ReactDOM.render(
      <Loading isLoading={false}/>,
      document.querySelector("#loading-container"));

    ReactDOM.render(
      <Error error={err}/>,
      document.querySelector("#error-container"));
  }
}

// Whenever the DOM is ready is when we want to start doing work on rendering
// the scene. That's because the canvas where we render stuff needs to be
// ready for creating the webgl context.
onReady(() => {
  // webgl context! There is where we render all the stuff. This is
  // the thing that renders to screen.
  const gl = webgl.createContext(document.querySelector("#glCanvas"));

  const app = new App();
  app.init();

  window.scene.doRenderLoop(gl)
    .then(({resourceLoader, sceneManager, refreshProjection}) => {
      app.ready({resourceLoader, sceneManager, refreshProjection});
    })
    .catch(ex => {
      // Report error
      app.error(ex);
    });
});
