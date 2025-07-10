import { CSVParser } from '../csv-parser.js';
import { iterStream } from '../utils/stream.js';
import { CSVParseOptions } from './parse-csv-table.js';
import { StreamedEntry } from './zip-extractor.js';
import { MultiDirectedGraph } from 'graphology';

/**
 * @param indexedTableNames - maps node types to table names
 * @param cachedIndices - maps table names to the table index
 */
export async function csvToGraph(
  entry: StreamedEntry,
  graph: MultiDirectedGraph,
  options?: CSVParseOptions,
  indexedTableNames: Record<string, string> = {},
  cachedIndices: Record<string, Map<string | number, Record<string, any>>> = {},
  dsPromises: Record<string, { promise: Promise<any[]> }> = {},
) {
  const [from, edgeType, to] = entry.filename.split('/').pop().split('_');
  const stream = entry.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new CSVParser({
        delimiter: options.separator ?? ',',
        columns: options.columns,
        cast:
          options.cast === true
            ? true
            : (val, ctx) => {
                if (ctx.header) return val;
                const castFn = (
                  options.cast as Record<string, (v: string) => any>
                )?.[ctx.column];
                if (castFn) {
                  return castFn(val);
                }
                return val;
              },
        castDate: options.cast === true,
      }),
    );
  const fromIndex =
    from in indexedTableNames
      ? await getTableIndex(indexedTableNames[from], dsPromises, cachedIndices)
      : null;
  const toIndex =
    to in indexedTableNames
      ? await getTableIndex(indexedTableNames[to], dsPromises, cachedIndices)
      : null;

  const iter = iterStream(stream)[
    Symbol.asyncIterator
  ]() as any as AsyncIterableIterator<any[]>;
  const currentState = await iter.next();
  const edgeProps = currentState.value.slice(2) as string[];
  for await (const row of iter) {
    const fromNode = from + row[0];
    const toNode = to + row[1];
    if (fromIndex) {
      if (!graph.hasNode(fromNode)) {
        const fromRow = fromIndex.get(row[0]) ?? { id: row[0] };
        fromRow['labels'] = [from];
        graph.addNode(fromNode, fromRow);
      }
    } else {
      graph.mergeNode(fromNode, { id: row[0], labels: [from] });
    }
    if (toIndex) {
      if (!graph.hasNode(toNode)) {
        const toRow = toIndex.get(row[1]) ?? { id: row[1] };
        toRow['labels'] = [to];
        graph.addNode(toNode, toRow);
      }
    } else {
      graph.mergeNode(toNode, { id: row[1], labels: [to] });
    }
    graph.addEdge(fromNode, toNode, {
      type: edgeType,
      ...Object.fromEntries(edgeProps.map((key, i) => [key, row[2 + i]])),
    });
  }
}

async function getTableIndex(
  table: string,
  dsPromises: Record<string, { promise: Promise<any[]> }>,
  cachedIndices: Record<string, Map<string | number, Record<string, any>>>,
  column = 'id',
): Promise<Map<string | number, Record<string, any>>> {
  const ds = await dsPromises[table].promise;
  if (cachedIndices[table]) {
    return cachedIndices[table];
  }
  const index = new Map<string | number, Record<string, any>>();
  for (const row of ds) {
    index.set(row[column], row);
  }
  cachedIndices[table] = index;
  return index;
}
