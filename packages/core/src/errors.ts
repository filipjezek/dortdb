/** Thrown when an operation or feature is not supported by the current configuration. */
export class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}
