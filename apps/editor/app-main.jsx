import React from "react";
import {createRoot} from "react-dom/client";
import {ready as domReady} from "@scenic/dom";
import {webgl} from "@scenic/renderer";

import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Console} from "./app/console.jsx";
import {Loading} from "./app/loading.jsx";

import _console from "./logging.js";

export class App {
  constructor({loadingRoot, sceneGraphRoot, errorRoot}) {
    this.loadingRoot = loadingRoot;
    this.sceneGraphRoot = sceneGraphRoot;
    this.errorRoot = errorRoot;
  }

  init() {
    // Let's show our app loading spinner
    this.loadingRoot.render(<Loading isLoading={true} />);
  }

  ready({sceneManager, resourceLoader, refreshProjection}) {
    // Let's mount the scene tree viewer
    this.sceneGraphRoot.render(
      <SceneGraph
        sceneManager={sceneManager}
        resourceLoader={resourceLoader}
        refreshProjection={refreshProjection}
      />
    );

    this.loadingRoot.render(<Loading isLoading={false} />);
  }

  error(err) {
    this.loadingRoot.render(<Loading isLoading={false} />);

    this.errorRoot.render(
      <>
        <Error error={err} />
        <Console buffer={_console.buffer} />
      </>
    );
  }
}

// Whenever the DOM is ready is when we want to start doing work on rendering
// the scene. That's because the canvas where we render stuff needs to be
// ready for creating the webgl context.
domReady.onReady(() => {
  // webgl context! There is where we render all the stuff. This is
  // the thing that renders to screen.
  const gl = webgl.createContext(document.querySelector("#glCanvas"));

  const app = new App({
    loadingRoot: createRoot(document.querySelector("#loading-container")),
    sceneGraphRoot: createRoot(document.querySelector("#scene-graph-container")),
    errorRoot: createRoot(document.querySelector("#error-container")),
  });

  app.init();

  window.scene
    .doRenderLoop(gl)
    .then(({registerRefreshRateUpdater, resourceLoader, sceneManager, refreshProjection}) => {
      app.ready({resourceLoader, sceneManager, refreshProjection});

      const fpsEl = document.querySelector("#fps");
      registerRefreshRateUpdater((fps) => {
        fpsEl.innerHTML = fps;
      });
    })
    .catch((ex) => {
      // Report error
      app.error(ex);
    });
});
