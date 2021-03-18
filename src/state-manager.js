export class StateManager {
  constructor(items) {
    this.items = items;
    this.itemsByName = StateManager.getItemsByName(items);
  }

  getItems() {
    return this.items;
  }

  getAllItemsByName() {
    return this.itemsByName;
  }

  getItemByName(name) {
    if (!this.itemsByName.hasOwnProperty(name)) {
      throw new Error(`State item with name "${name}" not found`)
    }

    return this.itemsByName[name];
  }

  updateItemByName(name, item) {
    if (!this.itemsByName.hasOwnProperty(name)) {
      throw new Error(`State item with name "${name}" not found`)
    }

    Object.assign(this.itemsByName[name], item);
    return this;
  }

  static getItemsByName(items) {
    const allItems = [...items];
    const itemsByName = {};

    // This will iterate thru all the items in a breadth first order.
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      if (itemsByName.hasOwnProperty(item.name)) {
        throw new Error(`Configuration item "${item.name}" already exists`);
      }

      itemsByName[item.name] = { ...item};

      const {items=[]} = item;

      // Using i here allows us to array the items in the array in a depth
      // first order.
      // If we wanted breadth first, then we can switch i with items.length
      allItems.splice(i+1, 0, ...items);
    }

    return itemsByName;
  }
}
