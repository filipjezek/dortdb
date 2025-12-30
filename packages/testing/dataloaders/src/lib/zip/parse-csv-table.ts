import { CSVParser } from '../csv-parser.js';
import { iterStream, toArray } from '../utils/stream.js';
import { StreamedEntry } from './zip-extractor.js';

export interface CSVParseOptions {
  cast?: Record<string, (v: string) => any> | true;
  columns?: string[] | true | undefined;
  separator?: string;
}

export async function parseCSVTable(
  entry: StreamedEntry,
  result: Record<string, any>,
  resultKey: string,
  options: CSVParseOptions = {},
  dsPromises?: Record<
    string,
    { promise: Promise<any>; resolve: (val: any) => any }
  >,
) {
  const stream = entry.readable
    .pipeThrough(
      // type incompatibility between node:stream/web and DOM streams
      new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>,
    )
    .pipeThrough(
      new CSVParser({
        delimiter: options.separator ?? ',',
        escape: '\\',
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
  result[resultKey] = await toArray(iterStream(stream));
  if (dsPromises) {
    dsPromises[resultKey].resolve(result[resultKey]);
  }
}
