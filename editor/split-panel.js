import {Subscription} from "../src/dom/events.js";

export function createSplitPanel(el) {
  let resizeEnabled = false;
  const resizerEl = el.querySelector(".resizer");

  if (!resizerEl) {
    throw new Error("Unable to find resizer element");
  }

  Subscription.create(resizerEl).on("mousedown", () => {
    resizeEnabled = true;
  });

  Subscription.create(el)
    .on("mouseup", () => {
      resizeEnabled = false;
    })
    .on("mousemove", (evt) => {
      if (resizeEnabled) {
        el.style.setProperty("--resizer-position", evt.clientX + "px");
        el.dispatchEvent(new Event("panel:resize"));
      }
    });
}
