import { Trie } from './trie.js';

describe('Trie', () => {
  let trie: Trie<string>;

  beforeEach(() => {
    trie = new Trie<string>();
  });

  test('should add and check existence of elements', () => {
    trie.add(['a', 'b', 'c']);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
    expect(trie.has(['a', 'b'])).toBe(false);
    expect(trie.has(['a', 'b', 'c', 'd'])).toBe(false);
  });

  test('should delete elements', () => {
    trie.add(['a', 'b', 'c']);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
    trie.delete(['a', 'b', 'c']);
    expect(trie.has(['a', 'b', 'c'])).toBe(false);
  });

  test('should clear all elements', () => {
    trie.add(['a', 'b', 'c']);
    trie.add(['d', 'e', 'f']);
    expect(trie.size).toBe(2);
    trie.clear();
    expect(trie.size).toBe(0);
    expect(trie.has(['a', 'b', 'c'])).toBe(false);
    expect(trie.has(['d', 'e', 'f'])).toBe(false);
  });

  test('should iterate over keys', () => {
    trie.add(['a', 'b', 'c']);
    trie.add(['a', 'd']);
    trie.add(['e']);
    const keys = Array.from(trie.keys());
    expect(keys).toEqual([['a', 'b', 'c'], ['a', 'd'], ['e']]);
  });

  test('should handle empty trie', () => {
    expect(trie.size).toBe(0);
    expect(trie.has(['a'])).toBe(false);
    expect(Array.from(trie.keys())).toEqual([]);
  });

  test('should handle adding duplicate elements', () => {
    trie.add(['a', 'b', 'c']);
    trie.add(['a', 'b', 'c']);
    expect(trie.size).toBe(1);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
  });

  test('should handle deletion of non-existent elements', () => {
    trie.add(['a', 'b', 'c']);
    trie.delete(['x', 'y', 'z']);
    expect(trie.size).toBe(1);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
  });

  test('should handle elements with symbols', () => {
    const sTrie = new Trie<symbol>();
    const symbolA = Symbol('a');
    const symbolB = Symbol('b');
    const symbolC = Symbol('c');

    sTrie.add([symbolA, symbolB, symbolC]);
    expect(sTrie.has([symbolA, symbolB, symbolC])).toBe(true);
    expect(sTrie.has([symbolA, symbolB])).toBe(false);
    expect(sTrie.has([symbolA, symbolB, symbolC, Symbol('d')])).toBe(false);

    sTrie.delete([symbolA, symbolB, symbolC]);
    expect(sTrie.has([symbolA, symbolB, symbolC])).toBe(false);
  });

  test('should prefix all elements', () => {
    trie.add(['a', 'b', 'c']);
    trie.add(['d', 'e', 'f']);
    trie.prefixAll(['x', 'y']);
    expect(trie.has(['x', 'y', 'a', 'b', 'c'])).toBe(true);
    expect(trie.has(['x', 'y', 'd', 'e', 'f'])).toBe(true);
    expect(trie.has(['a', 'b', 'c'])).toBe(false);
    expect(trie.has(['d', 'e', 'f'])).toBe(false);
    expect(trie.size).toBe(2);
  });

  test('should handle prefixing an empty trie', () => {
    trie.prefixAll(['x', 'y']);
    expect(trie.size).toBe(0);
    expect(trie.has(['x', 'y'])).toBe(false);
  });

  test('should handle prefixing with an empty prefix', () => {
    trie.add(['a', 'b', 'c']);
    trie.prefixAll([]);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
    expect(trie.size).toBe(1);
  });

  test('should handle prefixing with a single element prefix', () => {
    trie.add(['a', 'b', 'c']);
    trie.prefixAll(['x']);
    expect(trie.has(['x', 'a', 'b', 'c'])).toBe(true);
    expect(trie.has(['a', 'b', 'c'])).toBe(false);
    expect(trie.size).toBe(1);
  });

  test('should initialize with an iterable of arrays', () => {
    const source = [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ];
    trie = new Trie<string>(source);
    expect(trie.size).toBe(2);
    expect(trie.has(['a', 'b', 'c'])).toBe(true);
    expect(trie.has(['d', 'e', 'f'])).toBe(true);
  });

  test('should initialize with a record of string keys', () => {
    const source = { a: 1, b: 2, c: 3 };
    const trie = new Trie<string, number>(source);
    expect(trie.size).toBe(3);
    expect(trie.get(['a'])).toBe(1);
    expect(trie.get(['b'])).toBe(2);
    expect(trie.get(['c'])).toBe(3);
  });

  test('should initialize with a record of symbol keys', () => {
    const symbolA = Symbol('a');
    const symbolB = Symbol('b');
    const source = { [symbolA]: 1, [symbolB]: 2 };
    const trie = new Trie<symbol, number>(source);
    expect(trie.size).toBe(2);
    expect(trie.get([symbolA])).toBe(1);
    expect(trie.get([symbolB])).toBe(2);
  });

  test('should initialize with a mixed record of string and symbol keys', () => {
    const symbolA = Symbol('a');
    const source = { a: 1, [symbolA]: 2 };
    const trie = new Trie<string | symbol, number>(source);
    expect(trie.size).toBe(2);
    expect(trie.get(['a'])).toBe(1);
    expect(trie.get([symbolA])).toBe(2);
  });
});
