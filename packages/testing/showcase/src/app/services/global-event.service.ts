import { Injectable, inject } from '@angular/core';
import { animationFrameScheduler, fromEvent } from 'rxjs';
import { filter, observeOn, share } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class GlobalEventService {
  private doc = inject(DOCUMENT);
  public documentClicked = fromEvent<MouseEvent>(this.doc, 'click').pipe(
    share(),
  );
  public keyPressed = fromEvent<KeyboardEvent>(this.doc, 'keydown').pipe(
    share(),
  );
  public enterPressed = this.keyPressed.pipe(
    filter((e) => e.key === 'Enter'),
    share(),
  );
  public spacePressed = this.keyPressed.pipe(
    filter((e) => e.key === ' ' || e.key === 'Spacebar'),
    share(),
  );
  public escapePressed = this.keyPressed.pipe(
    filter((e) => e.key === 'Escape'),
    share(),
  );
  public mouseReleased = fromEvent<MouseEvent>(this.doc, 'mouseup').pipe(
    share(),
  );
  public mouseMove = fromEvent<MouseEvent>(this.doc, 'mousemove').pipe(
    observeOn(animationFrameScheduler),
    share(),
  );
}
