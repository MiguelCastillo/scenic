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

  static getItemsByID(items) {
    const allItems = [...items];
    const itemsByID = {};

    // This will iterate thru all the items in a breadth first order.
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      if (itemsByID.hasOwnProperty(item.id)) {
        throw new Error(`Configuration item "${item.id}" already exists`);
      }

      itemsByID[item.id] = { ...item};

      const {items=[]} = item;

      // Using i here allows us to array the items in the array in a depth
      // first order.
      // If we wanted breadth first, then we can switch i with items.length
      allItems.splice(i+1, 0, ...items);
    }

    return itemsByID;
  }
}
