// Usage:
// import { colors, timer } from "@scenic/utils";
//
// const hex = colors.rgbToHex(1, 0, 0);
// const rgb = colors.hexToRgb("#ff0000");
//
// const myTimer = new timer.Timer();
// myTimer.start();
// console.log(myTimer.elapsed());

import * as colors from "./colors.js";
import * as timer from "./timer.js";

export {colors, timer};
