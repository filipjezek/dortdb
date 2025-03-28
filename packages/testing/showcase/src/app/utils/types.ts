type Unpartiable = Function;

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends Unpartiable
      ? T[P]
      : T[P] extends object
        ? RecursivePartial<T[P]>
        : T[P];
};
