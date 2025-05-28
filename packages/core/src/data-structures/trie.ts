import { cloneDeep } from 'lodash-es';

const SENTINEL = Symbol('SENTINEL');

type TrieInner<T, U> = Map<T, TrieInner<T, U>> & Map<typeof SENTINEL, U | true>;

export class Trie<T, U = true> {
  private root: TrieInner<T, U> = new Map();
  public get size(): number {
    return this._size;
  }
  private _size = 0;

  constructor(
    source?: Iterable<T[]> | Record<Extract<T, string | symbol>, unknown>,
  ) {
    if (source) {
      if (Symbol.iterator in source) {
        for (const parts of source) {
          this.add(parts);
        }
      } else {
        for (const key in source) {
          this.set(
            [key as Extract<T, string>],
            source[key as Extract<T, string | symbol>] as U,
          );
        }
        for (const key of Object.getOwnPropertySymbols(source)) {
          this.set(
            [key as Extract<T, symbol>],
            source[key as Extract<T, string | symbol>] as U,
          );
        }
      }
    }
  }

  public add(parts: T[]): void {
    this.set(parts, true);
  }
  public set(parts: T[], value: U | true): void {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        lvl.set(part, new Map());
      }
      lvl = lvl.get(part) as TrieInner<T, U>;
    }
    if (!lvl.has(SENTINEL)) {
      this._size++;
    }
    lvl.set(SENTINEL, value);
  }

  public has(parts: T[]): boolean {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        return false;
      }
      lvl = lvl.get(part) as TrieInner<T, U>;
    }
    return lvl.has(SENTINEL);
  }
  public get(parts: T[]): U | undefined {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        return undefined;
      }
      lvl = lvl.get(part) as TrieInner<T, U>;
    }
    return lvl.get(SENTINEL) as U;
  }

  public delete(parts: T[]): boolean {
    const deleted = this.deleteRecursive(this.root, parts);
    if (deleted) {
      this._size--;
    }
    return deleted;
  }
  private deleteRecursive(lvl: TrieInner<T, U>, path: T[]): boolean {
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
  public prefixAll(prefix: T[]): void {
    if (prefix.length === 0 || !this.size) return;
    const oldRoot = this.root;
    this.root = new Map();
    let lvl = this.root;
    for (let i = 0; i < prefix.length - 1; i++) {
      lvl.set(prefix[i], (lvl = new Map()));
    }
    lvl.set(prefix.at(-1), oldRoot);
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

  public *entries(prefix: T[] = []): IterableIterator<[T[], U]> {
    let lvl = this.root;
    for (const key of prefix) {
      if (!lvl.has(key)) {
        return;
      }
      lvl = lvl.get(key);
    }
    yield* this.iterTrieInnerEntries(lvl, prefix);
  }

  private *iterTrieInner(
    lvl: TrieInner<T, U>,
    path: T[],
  ): IterableIterator<T[]> {
    for (const [key, next] of lvl) {
      if (key === SENTINEL) {
        yield path;
      } else if (next) {
        yield* this.iterTrieInner(next, path.concat(key));
      }
    }
  }
  private *iterTrieInnerEntries(
    lvl: TrieInner<T, U>,
    path: T[],
  ): IterableIterator<[T[], U]> {
    for (const [key, next] of lvl) {
      if (key === SENTINEL) {
        yield [path, lvl.get(SENTINEL) as U];
      } else if (next) {
        yield* this.iterTrieInnerEntries(next, path.concat(key));
      }
    }
  }

  public clone(deep = false): Trie<T, U> {
    const clonedRoot = deep
      ? cloneDeep(this.root)
      : this.shallowClone(this.root);
    const clonedTrie = new Trie<T, U>();
    clonedTrie.root = clonedRoot;
    clonedTrie._size = this._size;
    return clonedTrie;
  }

  private shallowClone(map: TrieInner<T, U>): TrieInner<T, U> {
    const clonedMap: TrieInner<T, U> = new Map();
    for (const [key, value] of map) {
      if (key === SENTINEL) {
        clonedMap.set(key, value);
      } else {
        clonedMap.set(key, this.shallowClone(value));
      }
    }
    return clonedMap;
  }
}
