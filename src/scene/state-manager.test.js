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
