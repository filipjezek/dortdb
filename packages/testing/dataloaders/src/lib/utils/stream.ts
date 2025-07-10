export async function* iterStream<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader();
  try {
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function toArray<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of iter) {
    arr.push(item);
  }
  return arr;
}
export async function streamToString(
  stream: ReadableStream<string>,
): Promise<string> {
  let str = '';
  for await (const item of iterStream(stream)) {
    str += item;
  }
  return str;
}
