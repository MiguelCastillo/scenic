// This will inject buffering into `console` so that we can access it later.
import "./logging.js";

// renderScene is exported to the global object (window in the browser)
// This is accomplished via the build/bundling process by configuring this
// file as the main entry point with a UMD export. See .pakit-scene.js for
// more details.
export {renderScene} from "@scenic/runtime";
