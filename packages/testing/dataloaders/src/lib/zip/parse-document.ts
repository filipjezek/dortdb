import { streamToString } from '../utils/stream.js';
import { StreamedEntry } from './zip-extractor.js';

export async function parseDocument(
  entry: StreamedEntry,
  result: Record<string, any>,
  resultKey: string,
  dsPromises?: Record<
    string,
    { promise: Promise<any>; resolve: (val: any) => any }
  >,
  parser = new DOMParser(),
) {
  const stream = entry.readable.pipeThrough(
    // type incompatibility between node:stream/web and DOM streams
    new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>,
  );
  const text = await streamToString(stream);
  const xml = parser.parseFromString(text, 'text/xml');
  result[resultKey] = xml;
  if (dsPromises) {
    dsPromises[resultKey].resolve(xml);
  }
}
