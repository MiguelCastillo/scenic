import {fixed3f} from "./float.js";

// Some fun weight functions https://easings.net/
// Easy In functions are great weight functions for the mouse because
// they slow down as they reach 0. Easy Out function will start a start
// slower and have a much longer fast tail to 0.
export const easeInExpo = (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)); // https://easings.net/#easeInExpo
export const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)); // https://easings.net/#easeOutExpo
export const easeInCirc = (x) => 1 - Math.sqrt(1 - Math.pow(x, 2)); // https://easings.net/#easeInCirc
export const easeOutCirc = (x) => Math.sqrt(1 - Math.pow(x - 1, 2)); // https://easings.net/#easeOutCirc
export const easeInSine = (x) => 1 - Math.cos((x * Math.PI) / 2); // https://easings.net/#easeInSine
export const easeOutSine = (x) => Math.sin((x * Math.PI) / 2); // https://easings.net/#easeOutSine
export const easeInQuad = (x) => x * x; // https://easings.net/#easeInQuad
export const easeOutQuad = (x) => 1 - (1 - x) * (1 - x); // https://easings.net/#easeOutQuad
export const easeInCubic = (x) => x * x * x; // https://easings.net/#easeInCubic
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3); // https://easings.net/#easeOutCubic
export const easeInQuart = (x) => x * x * x * x; // https://easings.net/#easeInQuart
export const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4); // https://easings.net/#easeOutQuart

export class WeightedItems {
  // Default is a linear weight
  constructor(weightFunction = (x) => x) {
    this.items = [];
    this.factor = 0;
    this.weightFunction = weightFunction;
  }

  start(items) {
    this.items = items;
    this.factor = 1;
  }

  reset() {
    this.factor = 0;
  }

  update(reduction = 0.01) {
    // Weighted world rotation.
    if (this.factor > 0) {
      this.factor = this.factor - reduction;
      return true;
    }
    this.factor = 0;
    return false;
  }

  getWeighted() {
    const weightedFactor = this.weightFunction(this.factor);
    return this.items.map((item) => fixed3f(item * weightedFactor));
  }
}
