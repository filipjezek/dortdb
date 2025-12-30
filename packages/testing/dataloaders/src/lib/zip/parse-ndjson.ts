import { NDJSONParser } from '../ndjson-parser.js';
import { iterStream, toArray } from '../utils/stream.js';
import { StreamedEntry } from './zip-extractor.js';

export async function parseNdjson(
  entry: StreamedEntry,
  result: Record<string, any>,
  resultKey: string,
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
    .pipeThrough(new NDJSONParser());
  result[resultKey] = await toArray(iterStream(stream));
  if (dsPromises) {
    dsPromises[resultKey].resolve(result[resultKey]);
  }
}
