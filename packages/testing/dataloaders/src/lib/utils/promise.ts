export function getPromise(): {
  promise: Promise<any>;
  resolve: (val: any) => any;
} {
  let cb: (val: any) => any;
  const promise = new Promise<any>((resolve) => {
    cb = resolve;
  });
  return { promise, resolve: cb };
}
