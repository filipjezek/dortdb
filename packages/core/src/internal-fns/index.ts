export function ret1<T>(a: T): T {
  return a;
}
export function ret2<T>(a: any, i: T) {
  return i;
}
export function retI0<T>(x: [T, ...any[]]): T {
  return x[0];
}
export function retI1<T>(x: [any, T, ...any]): T {
  return x[1];
}
export function toPair<T>(x: T): [T, T] {
  return [x, x];
}
