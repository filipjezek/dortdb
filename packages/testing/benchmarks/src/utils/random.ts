export function pickRandom<T>(array: T[]): T {
  return array[~~(Math.random() * array.length)];
}
