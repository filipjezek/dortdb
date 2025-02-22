const SENTINEL = Symbol('SENTINEL');

type TrieInner<T> = Map<T, TrieInner<T>> & Map<typeof SENTINEL, true>;
export class Trie<T> {
  private root: TrieInner<T> = new Map();
  public get size(): number {
    return this._size;
  }
  private _size = 0;

  constructor(source?: Iterable<T[]>) {}

  public add(parts: T[]): void {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        lvl.set(part, new Map());
      }
      lvl = lvl.get(part) as TrieInner<T>;
    }
    this._size += lvl.has(SENTINEL) ? 0 : 1;
    lvl.set(SENTINEL, true);
  }

  public has(parts: T[]): boolean {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        return false;
      }
      lvl = lvl.get(part) as TrieInner<T>;
    }
    return lvl.has(SENTINEL);
  }

  public delete(parts: T[]): boolean {
    const deleted = this.deleteRecursive(this.root, parts);
    if (deleted) {
      this._size--;
    }
    return deleted;
  }
  private deleteRecursive(lvl: TrieInner<T>, path: T[]): boolean {
    if (path.length === 0) {
      return lvl.delete(SENTINEL);
    }
    const [part, ...rest] = path;
    const next = lvl.get(part);
    if (next) {
      const deleted = this.deleteRecursive(next, rest);
      if (next.size === 0) {
        lvl.delete(part);
      }
      return deleted;
    }
    return false;
  }

  public clear(): void {
    this.root.clear();
    this._size = 0;
  }

  public [Symbol.iterator](): IterableIterator<T[]> {
    return this.keys();
  }
  public *keys(prefix: T[] = []): IterableIterator<T[]> {
    let lvl = this.root;
    for (const key of prefix) {
      if (!lvl.has(key)) {
        return;
      }
      lvl = lvl.get(key);
    }
    yield* this.iterTrieInner(lvl, prefix);
  }
  private *iterTrieInner(lvl: TrieInner<T>, path: T[]): IterableIterator<T[]> {
    for (const [key, next] of lvl) {
      if (key === SENTINEL) {
        yield path;
      } else if (next) {
        yield* this.iterTrieInner(next, path.concat(key));
      }
    }
  }
}
