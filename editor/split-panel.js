import {events as domEvents} from "@scenic/dom";

export function createSplitPanel(el) {
  let resizeEnabled = false;
  const resizerEl = el.querySelector(".resizer");

  if (!resizerEl) {
    throw new Error("Unable to find resizer element");
  }

  domEvents.Subscription.create(resizerEl).on("mousedown", () => {
    resizeEnabled = true;
  });

  domEvents.Subscription.create(el)
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
