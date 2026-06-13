/** Node in a singly-linked list. */
export class LinkedListNode<T = unknown> {
  constructor(
    /** The value held by this node. */
    public value: T,
    /** The next node in the list, or `null` at the tail. */
    public next: LinkedListNode<T> = null,
  ) {}
}
