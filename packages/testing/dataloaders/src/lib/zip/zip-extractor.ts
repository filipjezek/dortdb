import * as zip from '@zip.js/zip.js';
import { CSVParseOptions, parseCSVTable } from './parse-csv-table.js';
import { MultiDirectedGraph } from 'graphology';
import { iterStream } from '../utils/stream.js';
import { parseDocument } from './parse-document.js';
import { parseNdjson } from './parse-ndjson.js';
import { csvToGraph } from './csv-to-graph.js';
import { getPromise } from '../utils/promise.js';

export type StreamedEntry = Omit<zip.Entry, 'getData'> & {
  readable?: ReadableStream<Uint8Array>;
};

export interface ExtractedFileOptions {
  type: 'csv' | 'ndjson' | 'xml' | 'graph';
  /** not applicable for graphs */
  key?: string;
  csvOptions?: CSVParseOptions;
}

export async function extractArchive(
  archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  dataStructures: Record<string, ExtractedFileOptions>,
  xmlParser: DOMParser = new DOMParser(),
  graphKey = 'defaultGraph',
  graphTypesToTableNames: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const cachedIndices: Record<
    string,
    Map<string | number, Record<string, any>>
  > = {};
  const dsPromises: Record<
    string,
    { promise: Promise<any[]>; resolve: (val: any) => void }
  > = Object.fromEntries(
    Object.values(dataStructures)
      .filter(({ key }) => key)
      .map(({ key }) => [key, getPromise()]),
  );
  dsPromises[graphKey] = getPromise();

  const reader = new zip.ZipReaderStream();
  const writer = reader.writable.getWriter();
  (async () => {
    for await (const chunk of archive) {
      await writer.write(chunk);
    }
    await writer.close();
  })();

  const graph = new MultiDirectedGraph();
  const graphPromises: Promise<void>[] = [];
  const result = { [graphKey]: graph };
  for await (const entry of iterStream(reader.readable)) {
    if (!(entry.filename in dataStructures)) continue;
    const dsOptions = dataStructures[entry.filename];
    if (dsOptions.type === 'csv') {
      parseCSVTable(
        entry,
        result,
        dsOptions.key ?? entry.filename,
        dsOptions.csvOptions,
        dsPromises,
      );
    } else if (dsOptions.type === 'xml') {
      parseDocument(
        entry,
        result,
        dsOptions.key ?? entry.filename,
        dsPromises,
        xmlParser,
      );
    } else if (dsOptions.type === 'ndjson') {
      parseNdjson(entry, result, dsOptions.key ?? entry.filename, dsPromises);
    } else if (dsOptions.type === 'graph') {
      graphPromises.push(
        csvToGraph(
          entry,
          graph,
          dsOptions.csvOptions,
          graphTypesToTableNames,
          cachedIndices,
          dsPromises,
        ),
      );
    }
  }
  await Promise.all(graphPromises);
  dsPromises[graphKey].resolve(graph);
  await Promise.all(Object.values(dsPromises).map((p) => p.promise));
  return result;
}
