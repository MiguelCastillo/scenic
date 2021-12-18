import {StateManager} from "./state-manager.js";

test("flat array itemsByName", () => {
  const itemsByName = StateManager.getItemsByName([{
    name: "item1",
  }, {
    name: "item2",
  }]);

  expect(itemsByName["item1"]).toEqual({
    name: "item1"
  });

  expect(itemsByName["item2"]).toEqual({
    name: "item2"
  });
});

test("array with items itemsByName", () => {
  const itemsByName = StateManager.getItemsByName([{
    name: "item1",
    items: [{
      name: "item1.1",
      items: [{
        name: "item1.1.1",
      }]
    }, {
      name: "item1.2",
      items: [{
        name: "item1.2.1",
      }]
    }]
  }, {
    name: "item2",
    items: [{
      name: "item2.1",
    }, {
      name: "item2.2",
    }]
  }]);

  expect(Object.keys(itemsByName)).toEqual([
    "item1",
    "item1.1",
    "item1.1.1",
    "item1.2",
    "item1.2.1",
    "item2",
    "item2.1",
    "item2.2",
  ]);
});
