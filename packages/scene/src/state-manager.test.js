import {StateManager} from "./state-manager.js";

test("flat array itemsByID", () => {
  const itemsByID = StateManager.getItemsByID([
    {
      id: "item1",
    },
    {
      id: "item2",
    },
  ]);

  expect(itemsByID["item1"]).toEqual({
    id: "item1",
  });

  expect(itemsByID["item2"]).toEqual({
    id: "item2",
  });
});

test("array with items itemsByID", () => {
  const itemsByID = StateManager.getItemsByID([
    {
      id: "item1",
      items: [
        {
          id: "item1.1",
          items: [
            {
              id: "item1.1.1",
            },
          ],
        },
        {
          id: "item1.2",
          items: [
            {
              id: "item1.2.1",
            },
          ],
        },
      ],
    },
    {
      id: "item2",
      items: [
        {
          id: "item2.1",
        },
        {
          id: "item2.2",
        },
      ],
    },
  ]);

  expect(Object.keys(itemsByID)).toEqual([
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

test("addItems adds items and the items under them", () => {
  const stateManager = new StateManager([{id: "world"}]);
  stateManager.addItems([{id: "p2 ship", items: [{id: "p2 ship body"}]}]);

  expect(stateManager.getItemByID("p2 ship").id).toEqual("p2 ship");
  expect(stateManager.getItemByID("p2 ship body")).toEqual({id: "p2 ship body"});
});

test("addItems adds nothing when an id is taken", () => {
  const stateManager = new StateManager([{id: "world"}]);
  expect(() => stateManager.addItems([{id: "ship", items: [{id: "world"}]}])).toThrow(
    /"world" already exists/
  );
  expect(stateManager.getItemByID("ship")).toBeUndefined();
});

test("removeItemByID removes the item and the items under it", () => {
  const stateManager = new StateManager([{id: "world"}]);
  stateManager.addItems([{id: "p2 ship", items: [{id: "p2 ship body"}]}]);
  stateManager.removeItemByID("p2 ship");

  expect(stateManager.getItemByID("p2 ship")).toBeUndefined();
  expect(stateManager.getItemByID("p2 ship body")).toBeUndefined();
  expect(stateManager.getItemByID("world")).toEqual({id: "world"});
});
