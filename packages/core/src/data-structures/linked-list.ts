export class LinkedListNode<T = unknown> {
  constructor(
    public value: T,
    public next: LinkedListNode<T> = null,
  ) {}
}
