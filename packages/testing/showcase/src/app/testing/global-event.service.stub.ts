import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable()
export class GlobalEventServiceStub {
  constructor() {}

  public subj = new Subject<{
    type: string;
    event: any;
  }>();

  documentClicked = this.subj.pipe(
    filter(({ type }) => type.startsWith('click:')),
    map((x) => x.event)
  );
  overlayClicked = this.subj.pipe(
    filter(({ type }) => type === 'click:overlay'),
    map((x) => x.event)
  );
  keyPressed = this.subj.pipe(
    filter(({ type }) => type.startsWith('key:')),
    map((x) => x.event)
  );
  enterPressed = this.subj.pipe(
    filter(({ type }) => type === 'key:enter'),
    map((x) => x.event)
  );
  escapePressed = this.subj.pipe(
    filter(({ type }) => type === 'key:escape'),
    map((x) => x.event)
  );
  spacePressed = this.subj.pipe(
    filter(({ type }) => type === 'key:space'),
    map((x) => x.event)
  );
  mouseReleased = this.subj.pipe(
    filter(({ type }) => type === 'mouseup'),
    map((x) => x.event)
  );
  mouseMove = this.subj.pipe(
    filter(({ type }) => type === 'mousemove'),
    map((x) => x.event)
  );
}
