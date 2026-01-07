import { cloneDeep } from 'es-toolkit';

const SENTINEL = Symbol('SENTINEL');

type TrieInner<T, U> = Map<T, TrieInner<T, U>> & Map<typeof SENTINEL, U | true>;

/**
 * Trie data structure for storing sequences of keys with associated values.
 * Supports efficient prefix-based operations and iteration.
 * @template T Type of the key parts (e.g., string, symbol).
 * @template U Type of the value stored (default: true for set-like behavior).
 */
export class Trie<T, U = true> {
  private root: TrieInner<T, U> = new Map();
  /**
   * Number of entries in the trie.
   */
  public get size(): number {
    return this._size;
  }
  private _size = 0;

  /**
   * Creates a new Trie instance.
   * @param source Optional iterable of key arrays or object to initialize the trie.
   */
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

  /**
   * Adds a key sequence to the trie, storing `true` as the value.
   * @param parts Array of key parts.
   */
  public add(parts: T[]): void {
    this.set(parts, true);
  }
  /**
   * Sets a value for a key sequence in the trie.
   * @param parts Array of key parts.
   * @param value Value to associate with the key sequence.
   */
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

  /**
   * Checks if a key sequence exists in the trie.
   * @param parts Array of key parts.
   * @returns True if the key exists, false otherwise.
   */
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
  /**
   * Gets the value associated with a key sequence.
   * @param parts Array of key parts.
   * @param defaultVal Optional default value to set and return if the key is not found.
   * @returns The value if present, otherwise the provided default value.
   */
  public get(parts: T[], defaultVal?: U): U | undefined {
    let lvl = this.root;
    for (const part of parts) {
      if (!lvl.has(part)) {
        if (defaultVal !== undefined) {
          lvl.set(part, new Map());
        } else {
          return undefined;
        }
      }
      lvl = lvl.get(part) as TrieInner<T, U>;
    }
    if (defaultVal !== undefined && !lvl.has(SENTINEL)) {
      lvl.set(SENTINEL, defaultVal);
      this._size++;
      return defaultVal;
    }
    return lvl.get(SENTINEL) as U;
  }

  /**
   * Deletes a key sequence from the trie.
   * @param parts Array of key parts.
   * @returns True if the key was deleted, false if not found.
   */
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

  /**
   * Removes all entries from the trie.
   */
  public clear(): void {
    this.root.clear();
    this._size = 0;
  }
  /**
   * Adds a prefix to all existing keys in the trie.
   * @param prefix Array of key parts to prepend.
   */
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

  /**
   * Returns an iterator over all key sequences in the trie.
   * @returns IterableIterator of key arrays.
   */
  public [Symbol.iterator](): IterableIterator<T[]> {
    return this.keys();
  }
  /**
   * Returns an iterator over all key sequences, optionally starting with a prefix.
   * @param prefix Optional prefix to filter keys.
   * @returns IterableIterator of key arrays.
   */
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

  /**
   * Returns an iterator over all [key, value] pairs, optionally starting with a prefix.
   * @param prefix Optional prefix to filter entries.
   * @returns IterableIterator of [key array, value] pairs.
   */
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

  /**
   * Creates a clone of the trie.
   * @param deep If true, performs a deep clone; otherwise, shallow clone.
   * @returns A new Trie instance with the same contents.
   */
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
