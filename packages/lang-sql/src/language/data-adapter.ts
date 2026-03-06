/**
 * Data adapter for the SQL language.
 */
export interface SQLDataAdapter<Row = any> {
  /**
   * Create a column accessor for a specific property.
   * @param prop The property to create an accessor for.
   */
  createColumnAccessor(prop: string | symbol | number): (row: Row) => unknown;

  createRow(keys: string[], values: unknown[]): Row;
}

/**
 * SQL data adapter that treats JavaScript objects as table rows.
 */
export class ObjectDataAdapter implements SQLDataAdapter<
  Record<string | symbol, unknown>
> {
  createColumnAccessor(
    prop: string | symbol | number,
  ): (row: Record<string | symbol, unknown>) => unknown {
    return (row) => row[prop];
  }

  createRow(
    keys: string[],
    values: unknown[],
  ): Record<string | symbol, unknown> {
    const row: Record<string | symbol, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      row[keys[i]] = values[i];
    }
    return row;
  }
}
