export function makePath(src: any, ...parts: (string | symbol)[]) {
  for (const part of parts) {
    if (!(part in src)) {
      src[part] = {};
    }
    src = src[part];
  }
  return src;
}
