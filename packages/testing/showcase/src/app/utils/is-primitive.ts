export function isPrimitive(value: unknown) {
  return (
    !value ||
    ['number', 'string', 'boolean', 'bigint'].includes(typeof value) ||
    value instanceof Date
  );
}
