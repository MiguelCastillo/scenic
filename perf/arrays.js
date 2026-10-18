// Refilling an array, the way the hot path refills lists every frame, such
// as Mesh's copiesToRender (see "Refilling an array" in the README): written
// by index, with its length set once, at the end, it makes no garbage. This
// checks that the rule the README gives still holds on the Node, and so the
// V8, it runs on.

// The list, refilled with this many itemCount each time.
const itemCount = 100;

export const cases = [
  {
    name: `Refill an array of ${itemCount} by index`,
    per: "refill",
    budgetBytes: 1,
    setUp() {
      const list = [];
      const item = {};
      return () => {
        let count = 0;
        for (let i = 0; i < itemCount; i++) {
          list[count++] = item;
        }
        list.length = count;
      };
    },
  },
];
