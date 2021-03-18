const WEBGL = "webgl";
const WEBGL2 = "webgl2";

function createContext(canvas, version=WEBGL2) {
  canvas.height = canvas.clientHeight;
  canvas.width = canvas.clientWidth;

  // Initialize the GL context
  const context = canvas.getContext(version);

  // Only continue if WebGL is available and working
  if (context === null) {
    throw new Error(`Unable to initialize ${version}. Your browser or machine may not support it.`);
  }

  return context;
}

export default {
  WEBGL, WEBGL2,
  createContext,
};
