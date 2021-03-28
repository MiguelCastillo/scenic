import React from "react";
import ReactDOM from "react-dom";
import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Loading} from "./app/loading.jsx";

export class App {
  constructor() {
  }

  init({stateManager, resourceManager}) {
    // Let's show our app loading spinner
    ReactDOM.render(
      <Loading isLoading={true}/>,
      document.querySelector("#loading-container"));

    // Let's mount the scene tree viewer
    ReactDOM.render(
      <SceneGraph stateManager={stateManager} resourseManager={resourceManager}/>,
      document.querySelector("#scene-graph-container"));
  }

  ready() {
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
