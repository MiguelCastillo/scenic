export const WEBGL = "webgl";
export const WEBGL2 = "webgl2";

export function createContext(canvas, version=WEBGL2) {
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

export function getDebugData(gl) {
  // camelCase converts snake_case (case insensitive) to camelCase.
  const camelCase = (x) => x.toLowerCase().replace(/_[a-z]/g, x => x.replace(x, x.substr(1).toUpperCase()));
  const contextAttributes = gl.getContextAttributes();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  const limits = [
    "MAX_CUBE_MAP_TEXTURE_SIZE",
    "MAX_RENDERBUFFER_SIZE",
    "MAX_TEXTURE_SIZE",
    "MAX_VIEWPORT_DIMS",
    "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
    "MAX_TEXTURE_IMAGE_UNITS",
    "MAX_COMBINED_TEXTURE_IMAGE_UNITS",
    "MAX_VERTEX_ATTRIBS",
    "MAX_VARYING_VECTORS",
    "MAX_VERTEX_UNIFORM_VECTORS",
    "MAX_FRAGMENT_UNIFORM_VECTORS",
    "ALIASED_POINT_SIZE_RANGE",
  ].reduce((acc, x) => {
    acc[camelCase(x)] = gl.getParameter(gl[x]);
    return acc;
  }, {});

  return {
    vendor,
    renderer,
    limits,
    contextAttributes,
  };
}
