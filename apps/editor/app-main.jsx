import React from "react";
import {createRoot} from "react-dom/client";
import {ready as domReady} from "@scenic/dom";
import {webgl} from "@scenic/renderer";

import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Console} from "./app/console.jsx";
import {Loading} from "./app/loading.jsx";

import _console from "./logging.js";

domReady.onReady(() => {
  const gl = webgl.createContext(document.querySelector("#glCanvas"));
  const errorRoot = createRoot(document.querySelector("#error-container"));
  const loadingRoot = createRoot(document.querySelector("#loading-container"))
  loadingRoot.render(<Loading isLoading={true} />);

  // window.scene is exported from scene-main.js via the UMD export.
  // See .pakit-scene.js for more details.
  // TODO(miguel): add a way to load a scene from the editor.
  window.scene
    .doRenderLoop(gl, "scenes/skinning-mesh-animation-dancing-character.json")
    .then(({registerRefreshRateUpdater, resourceLoader, sceneManager, refreshProjection}) => {
      const mainRoot = createRoot(document.querySelector("#scene-graph-container"));

      mainRoot.render(
        <SceneGraph
          sceneManager={sceneManager}
          resourceLoader={resourceLoader}
          refreshProjection={refreshProjection}
        />
      );

      const fpsEl = document.querySelector("#fps");
      registerRefreshRateUpdater((fps) => {
        fpsEl.innerHTML = fps;
      });

      loadingRoot.render(<Loading isLoading={false} />);
    })
    .catch((ex) => {
      loadingRoot.render(<Loading isLoading={false} />);
      errorRoot.render(
        <>
          <Error error={ex} />
          <Console buffer={_console.buffer} />
        </>
      );
    });
});
