/**
 * Returns a function that returns null if any of the arguments are null or undefined, otherwise it calls the original function.
 * Used in languages with three-valued logic to avoid having to check for nulls in every function.
 */
export function shortcutNulls<T extends (...args: any[]) => any>(
  fn: T,
  nullVal: any = null,
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    for (const arg of args) {
      if (arg === null || arg === undefined) {
        return nullVal as ReturnType<T>;
      }
    }
    return fn(...args);
  }) as T;
}
