// eslint-disable-next-line no-unused-vars
import React from "react";
import ReactDOM from "react-dom";
// eslint-disable-next-line no-unused-vars
import {SceneGraph} from "./app/app.jsx";
// eslint-disable-next-line no-unused-vars
import {Error} from "./app/error.jsx";
// eslint-disable-next-line no-unused-vars
import {Console} from "./app/console.jsx";
// eslint-disable-next-line no-unused-vars
import {Loading} from "./app/loading.jsx";
import {onReady} from "../src/dom/ready.js";
import * as webgl from "../src/webgl.js";

import _console from "./logging.js";

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
      <>
        <Error error={err}/>
        <Console buffer={_console.buffer}/>
      </>,
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
    .then(({registerRefreshRateUpdater, resourceLoader, sceneManager, refreshProjection}) => {
      app.ready({resourceLoader, sceneManager, refreshProjection});

      const fpsEl = document.querySelector("#fps");
      registerRefreshRateUpdater((fps) => {
        fpsEl.innerHTML = fps;
      });
    })
    .catch(ex => {
      // Report error
      app.error(ex);
    });
});
