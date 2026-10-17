export class StateManager {
  constructor(items) {
    this.items = items;
    this.itemsByID = StateManager.getItemsByID(items);
  }

  getItems() {
    return this.items;
  }

  getAllItemsByName() {
    return this.itemsByID;
  }

  getItemByID(id) {
    return this.itemsByID[id];
  }

  updateItemByID(id, item) {
    this.itemsByID[id] = Object.assign({}, this.itemsByID[id], item);
    return this;
  }

  // addItems adds items, and the items under them, to a running scene's
  // state, such as another player's ship. It throws, adding nothing, if any of
  // their ids is already in the state.
  addItems(items) {
    const added = StateManager.getItemsByID(items);
    for (const id of Object.keys(added)) {
      if (this.itemsByID.hasOwnProperty(id)) {
        throw new Error(`Configuration item "${id}" already exists`);
      }
    }
    Object.assign(this.itemsByID, added);
    return this;
  }

  // removeItemByID takes the item out of the state, with the items that were
  // added under it.
  removeItemByID(id) {
    const item = this.itemsByID[id];
    if (item) {
      Object.keys(StateManager.getItemsByID([item])).forEach((removed) => {
        delete this.itemsByID[removed];
      });
    }
    return this;
  }

  static getItemsByID(items) {
    const allItems = [...items];
    const itemsByID = {};

    // This will iterate thru all the items in a breadth first order.
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      if (itemsByID.hasOwnProperty(item.id)) {
        throw new Error(`Configuration item "${item.id}" already exists`);
      }

      itemsByID[item.id] = {...item};

      const {items = []} = item;

      // Using i here allows us to array the items in the array in a depth
      // first order.
      // If we wanted breadth first, then we can switch i with items.length
      allItems.splice(i + 1, 0, ...items);
    }

    return itemsByID;
  }
}
