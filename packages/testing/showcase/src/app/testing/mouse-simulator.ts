import { ComponentFixture } from '@angular/core/testing';
import { GlobalEventServiceStub } from './global-event.service.stub';

export class MouseSimulator {
  constructor(
    public x: number,
    public y: number,
    private gEventS: GlobalEventServiceStub,
    private fixture?: ComponentFixture<any>
  ) {}

  public event(type: string, el: HTMLElement) {
    const e = new MouseEvent(type, { clientX: this.x, clientY: this.y });
    el.dispatchEvent(e);
    this.gEventS.subj.next({ type, event: e });
    this.fixture?.detectChanges();
    return this;
  }

  public move(deltaX: number, deltaY: number) {
    this.x += deltaX;
    this.y += deltaY;
    return this;
  }
}
