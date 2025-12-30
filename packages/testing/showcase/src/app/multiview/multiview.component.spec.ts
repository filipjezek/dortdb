import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';

import {
  GroupingFn,
  MultiviewComponent,
  OrderingFn,
} from './multiview.component';
import { MultiviewPartitionComponent } from './multiview-partition/multiview-partition.component';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { GlobalEventService } from '../services/global-event.service';
import { GlobalEventServiceStub } from '../testing/global-event.service.stub';
import { MouseSimulator } from '../testing/mouse-simulator';
import { promiseTimeout } from '../utils/promise-timeout';

@Component({
  template: `
    <dort-multiview
      [(ratios)]="ratios"
      [mainAxisOrder]="mainAxisOrder"
      [secondaryAxisOrder]="secondaryAxisOrder"
      [secondaryAxisGroup]="secondaryAxisGroup"
      [vertical]="vertical"
    >
      <dort-multiview-partition data="1" (visible)="visible[0] = $event"
        ><p>a</p></dort-multiview-partition
      >
      <dort-multiview-partition data="2" (visible)="visible[1] = $event"
        ><p>b</p></dort-multiview-partition
      >
      <dort-multiview-partition data="3" (visible)="visible[2] = $event"
        ><p>c</p></dort-multiview-partition
      >
    </dort-multiview>
  `,
  styles: [
    `
      dort-multiview {
        width: 400px;
        height: 200px;
      }
    `,
  ],
  imports: [MultiviewComponent, MultiviewPartitionComponent],
})
class Container {
  vertical = false;
  ratios = [30, 30, 40];
  mainAxisOrder: OrderingFn = undefined;
  secondaryAxisOrder: OrderingFn = undefined;
  secondaryAxisGroup: GroupingFn = undefined;

  visible = [true, true, true];
}

describe('MultiviewComponent', () => {
  let component: Container;
  let fixture: ComponentFixture<Container>;
  let gEventS: GlobalEventServiceStub;
  let el: HTMLElement;
  const getGrid = () =>
    Array.from(el.querySelectorAll('.group')).map((g) =>
      Array.from(g.querySelectorAll('p')).map((p) => p.textContent),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiviewComponent, MultiviewPartitionComponent, Container],
      providers: [
        { provide: GlobalEventService, useClass: GlobalEventServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Container);
    component = fixture.componentInstance;
    gEventS = TestBed.inject(GlobalEventService) as any;
    fixture.detectChanges();
    el = fixture.nativeElement;
    await promiseTimeout();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('resizing', () => {
    let handles: HTMLElement[];
    const grabHandle = (handle: HTMLElement) => {
      const bbox = handle.getBoundingClientRect();
      const mouse = new MouseSimulator(
        bbox.x + bbox.width / 2,
        bbox.y + bbox.height / 2,
        gEventS,
        fixture,
      ).event('mousedown', handle);
      tick();
      return mouse;
    };
    const height = 200;
    const width = 400;
    const assertConsistency = (ratios: number[]) => {
      expect(component.ratios) // component.ratios should be
        .toEqual(ratios);
      expect(component.ratios) // component.ratios equal template state
        .toEqual(
          Array.from(el.querySelectorAll('.group')).map((x) => {
            if (component.vertical) {
              return (x.clientHeight / height) * 100;
            } else {
              return (x.clientWidth / width) * 100;
            }
          }),
        );
    };

    beforeEach(() => {
      handles = Array.from(el.querySelectorAll('.handle'));
    });

    it('should resize horizontally', fakeAsync(() => {
      component.ratios = [20, 20, 60];
      fixture.detectChanges();
      assertConsistency([20, 20, 60]);
      let mouse = grabHandle(handles[0])
        .move(width * 0.1, 0)
        .event('mousemove', el);
      assertConsistency([30, 10, 60]);

      mouse
        .move(width * -0.15, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([15, 25, 60]);
    }));

    it('should resize vertically', fakeAsync(() => {
      component.ratios = [20, 20, 60];
      component.vertical = true;
      fixture.detectChanges();
      assertConsistency([20, 20, 60]);
      let mouse = grabHandle(handles[0])
        .move(0, height * 0.1)
        .event('mousemove', el);
      assertConsistency([30, 10, 60]);

      mouse
        .move(0, height * -0.15)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([15, 25, 60]);
    }));

    it('should not go into negative ratios', fakeAsync(() => {
      const min = (MultiviewPartitionComponent.minSize / width) * 100;
      component.ratios = [20, 20, 60];
      fixture.detectChanges();
      assertConsistency([20, 20, 60]);
      let mouse = grabHandle(handles[0])
        .move(width * 0.5, 0)
        .event('mousemove', el);
      assertConsistency([40 - min, min, 60]);

      mouse
        .move(width * -1, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([min, 40 - min, 60]);
    }));

    it('should notify visibility changes', fakeAsync(() => {
      component.ratios = [20, 20, 60];
      fixture.detectChanges();
      let mouse = grabHandle(handles[0])
        .move(width * 0.5, 0)
        .event('mousemove', el);
      expect(component.visible).toEqual([true, false, true]);

      mouse
        .move(width * -1, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      expect(component.visible).toEqual([false, true, true]);
    }));
  });

  describe('ordering', () => {
    it('should order items by template order', () => {
      expect(getGrid()).toEqual([['a'], ['b'], ['c']]);
    });
    it('should order items by provided function', fakeAsync(() => {
      component.mainAxisOrder = (a, b) => b.data() - a.data();
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
      expect(getGrid()).toEqual([['c'], ['b'], ['a']]);
    }));
  });

  describe('grouping', () => {
    beforeEach(fakeAsync(() => {
      component.secondaryAxisGroup = (p) => p.data() % 2;
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }));

    it('should group items', () => {
      expect(getGrid()).toEqual([['b'], ['a', 'c']]);
    });
    it('should order items on secondary axis by provided function', fakeAsync(() => {
      component.secondaryAxisOrder = (a, b) => b.data() - a.data();
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
      expect(getGrid()).toEqual([['b'], ['c', 'a']]);
    }));
  });
});
