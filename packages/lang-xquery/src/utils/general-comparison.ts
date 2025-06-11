export function generalComparison(
  fn: (a: any, b: any) => boolean,
  a: any,
  b: any,
): boolean {
  if (Array.isArray(a)) {
    if (Array.isArray(b)) {
      return a.some((itemA) => b.some((itemB) => fn(itemA, itemB)));
    }
    return a.some((item) => fn(item, b));
  }
  if (Array.isArray(b)) {
    return b.some((item) => fn(a, item));
  }
  return fn(a, b);
}
