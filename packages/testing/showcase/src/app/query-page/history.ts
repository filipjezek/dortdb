export class History<T extends string | number> {
  private static instances = 0;
  private readonly lsKey = 'history-' + History.instances++;
  private _items: T[] = [];
  private _itemsSet = new Set<T>();

  public get items() {
    return this._items as ReadonlyArray<T>;
  }

  constructor(public maxSize: number) {
    const items = localStorage.getItem(this.lsKey);
    const parsed = JSON.parse(items ?? '[]');
    if (Array.isArray(parsed)) {
      this._items = parsed;
      this._itemsSet = new Set(this._items);
    }
  }

  public clear() {
    this._items = [];
    this._itemsSet.clear();
    this.sync();
  }

  public push(item: T) {
    if (this._itemsSet.has(item)) {
      const i = this._items.indexOf(item);
      this._items.splice(i, 1);
    } else if (this._items.length >= this.maxSize) {
      const removed = this._items.shift();
      this._itemsSet.delete(removed);
    }
    this._items.push(item);
    this._itemsSet.add(item);
    this.sync();
  }

  public remove(item: T) {
    if (this._itemsSet.has(item)) {
      const i = this._items.indexOf(item);
      this._items.splice(i, 1);
      this._itemsSet.delete(item);
      this.sync();
    }
  }

  private sync() {
    localStorage.setItem(this.lsKey, JSON.stringify(this._items));
  }
}
