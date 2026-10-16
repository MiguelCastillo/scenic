import {Subscription} from "./events.js";

// InputCapture is all of a page's input for a scene, such as a game's canvas:
// the keyboard, and the mouse, touches, wheel, clicks and pointer lock on
// element. It turns them into plain events and gives every subscriber each
// one as it happens, and knows nothing about scenes, so apps can route input
// however they like by subscribing:
// - {type: "keydown", code, key, repeat} and {type: "keyup", code, key}:
//   code is where the key is, the same on every keyboard layout, for
//   controls, and key is what it types, for anything that needs characters.
// - {type: "mousemove", x, y} and {type: "wheel", x, y}: how far the mouse
//   moved and the wheel scrolled, in pixels, with positive y down.
// - {type: "pointerdown" | "pointermove" | "pointerup", id, kind, x, y}: a
//   pointer, such as a finger, touching element, moving and lifting, where
//   it is on the page in pixels. id tells pointers apart, such as two
//   fingers, and kind is "touch", "mouse" or "pen". A pointer the browser
//   takes over, such as for a system gesture, is lifted too.
// - {type: "click", kind}: element clicked or tapped, with the kind of
//   pointer that did it.
// - {type: "pointerlock", locked}, when the pointer is locked to element or
//   let go, such as with Escape.
// - {type: "visibility", hidden}, when the page is hidden or shown again,
//   such as when switching apps on a tablet.
//
// While the pointer is locked, keys that would scroll the page, scrollKeys,
// don't, since the scene uses them, and scrolling over element never leaves
// the page, such as when scrolling sideways on a trackpad.
//
// Its API: onInput(cb), which returns a function that stops it, locked,
// lock() and unlock().
export class InputCapture {
  constructor(
    element,
    {scrollKeys = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])} = {}
  ) {
    this._element = element;
    this._listeners = new Set();
    const send = (event) => this._listeners.forEach((cb) => cb(event));

    const sendPointer = (type) => (evt) =>
      send({type, id: evt.pointerId, kind: evt.pointerType, x: evt.clientX, y: evt.clientY});

    // Touches drive the scene, not the page, so they don't scroll or zoom it.
    element.style.touchAction = "none";

    // The kind of pointer that last touched element, for clicks, which not
    // every browser says.
    let lastPointerKind = "mouse";

    Subscription.create(element)
      .on("click", (evt) => send({type: "click", kind: evt.pointerType || lastPointerKind}))
      .on("pointerdown", (evt) => {
        lastPointerKind = evt.pointerType;
        // A pointer keeps telling element where it is until it lifts, even
        // when it moves off element.
        element.setPointerCapture(evt.pointerId);
        sendPointer("pointerdown")(evt);
      })
      .on("pointermove", sendPointer("pointermove"))
      .on("pointerup", sendPointer("pointerup"))
      .on("pointercancel", sendPointer("pointerup"))
      .on("mousemove", (evt) => send({type: "mousemove", x: evt.movementX, y: evt.movementY}))
      .on("wheel", (evt) => {
        evt.preventDefault();
        send({type: "wheel", x: evt.deltaX, y: evt.deltaY});
      });

    Subscription.create(document)
      .on("keydown", (evt) => {
        if (this.locked && scrollKeys.has(evt.code)) {
          evt.preventDefault();
        }
        send({type: "keydown", code: evt.code, key: evt.key, repeat: evt.repeat});
      })
      .on("keyup", (evt) => send({type: "keyup", code: evt.code, key: evt.key}))
      .on("pointerlockchange", () => send({type: "pointerlock", locked: this.locked}))
      .on("visibilitychange", () => send({type: "visibility", hidden: document.hidden}));
  }

  get locked() {
    return document.pointerLockElement === this._element;
  }

  onInput(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  lock() {
    this._element.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }
}
