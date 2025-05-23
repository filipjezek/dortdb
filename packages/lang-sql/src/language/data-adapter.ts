export interface SQLDataAdapter<Row = any> {
  createColumnAccessor(prop: string | symbol | number): (row: Row) => unknown;
}

export class ObjectDataAdapter
  implements SQLDataAdapter<Record<string | symbol, unknown>>
{
  createColumnAccessor(
    prop: string | symbol | number,
  ): (row: Record<string | symbol, unknown>) => unknown {
    return (row) => row[prop];
  }
}
