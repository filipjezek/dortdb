import { parse, type parser } from 'csv/browser/esm';

export class CSVParser extends TransformStream<
  string,
  Record<string, unknown>[]
> {
  constructor(options?: parser.Options) {
    super(CSVParser.createTransformer(options));
  }

  private static createTransformer(
    options?: parser.Options,
  ): Transformer<string, Record<string, unknown>[]> {
    const parser = parse({ columns: true, ...options });
    return {
      start(controller) {
        parser.on('readable', () => {
          let record;
          while ((record = parser.read())) {
            controller.enqueue(record);
            record = parser.read();
          }
        });
        parser.on('error', (error) => {
          controller.error(error);
        });
        parser.on('end', () => {
          controller.terminate();
        });
      },
      transform(chunk) {
        parser.write(chunk);
      },
      flush() {
        parser.end();
      },
    };
  }
}
