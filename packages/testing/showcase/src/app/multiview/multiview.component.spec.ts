import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  GroupingFn,
  MultiviewComponent,
  OrderingFn,
} from './multiview.component';
import { MultiviewPartitionComponent } from './multiview-partition/multiview-partition.component';
import {
  ChangeDetectionStrategy,
  Component,
  model,
  provideZonelessChangeDetection,
} from '@angular/core';
import { GlobalEventService } from '../services/global-event.service';
import { GlobalEventServiceStub } from '../testing/global-event.service.stub';
import { MouseSimulator } from '../testing/mouse-simulator';

@Component({
  template: `
    <dort-multiview
      [(ratios)]="ratios"
      [(mainAxisOrder)]="mainAxisOrder"
      [(secondaryAxisOrder)]="secondaryAxisOrder"
      [(secondaryAxisGroup)]="secondaryAxisGroup"
      [(vertical)]="vertical"
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Container {
  vertical = model(false);
  ratios = model([30, 30, 40]);
  mainAxisOrder = model<OrderingFn>(undefined);
  secondaryAxisOrder = model<OrderingFn>(undefined);
  secondaryAxisGroup = model<GroupingFn>(undefined);

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
        provideZonelessChangeDetection(),
        { provide: GlobalEventService, useClass: GlobalEventServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Container);
    component = fixture.componentInstance;
    gEventS = TestBed.inject(GlobalEventService) as any;
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('resizing', () => {
    let handles: HTMLElement[];
    const grabHandle = async (handle: HTMLElement) => {
      const bbox = handle.getBoundingClientRect();
      const mouse = new MouseSimulator(
        bbox.x + bbox.width / 2,
        bbox.y + bbox.height / 2,
        gEventS,
        fixture,
      ).event('mousedown', handle);
      await fixture.whenStable();
      return mouse;
    };
    const height = 200;
    const width = 400;
    const assertConsistency = (ratios: number[]) => {
      expect(component.ratios()) // component.ratios should be
        .toEqual(ratios);
      expect(component.ratios()) // component.ratios equal template state
        .toEqual(
          Array.from(el.querySelectorAll('.group')).map((x) => {
            if (component.vertical()) {
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

    it('should resize horizontally', async () => {
      component.ratios.set([20, 20, 60]);
      await fixture.whenStable();
      assertConsistency([20, 20, 60]);
      let mouse = (await grabHandle(handles[0]))
        .move(width * 0.1, 0)
        .event('mousemove', el);
      assertConsistency([30, 10, 60]);

      mouse
        .move(width * -0.15, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([15, 25, 60]);
    });

    it('should resize vertically', async () => {
      component.ratios.set([20, 20, 60]);
      component.vertical.set(true);
      await fixture.whenStable();
      assertConsistency([20, 20, 60]);
      let mouse = (await grabHandle(handles[0]))
        .move(0, height * 0.1)
        .event('mousemove', el);
      assertConsistency([30, 10, 60]);

      mouse
        .move(0, height * -0.15)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([15, 25, 60]);
    });

    it('should not go into negative ratios', async () => {
      const min = (MultiviewPartitionComponent.minSize / width) * 100;
      component.ratios.set([20, 20, 60]);
      await fixture.whenStable();
      assertConsistency([20, 20, 60]);
      let mouse = (await grabHandle(handles[0]))
        .move(width * 0.5, 0)
        .event('mousemove', el);
      assertConsistency([40 - min, min, 60]);

      mouse
        .move(width * -1, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      assertConsistency([min, 40 - min, 60]);
    });

    it('should notify visibility changes', async () => {
      component.ratios.set([20, 20, 60]);
      await fixture.whenStable();
      let mouse = (await grabHandle(handles[0]))
        .move(width * 0.5, 0)
        .event('mousemove', el);
      expect(component.visible).toEqual([true, false, true]);

      mouse
        .move(width * -1, 0)
        .event('mousemove', el)
        .event('mouseup', el);
      expect(component.visible).toEqual([false, true, true]);
    });
  });

  describe('ordering', () => {
    it('should order items by provided function', async () => {
      component.mainAxisOrder.set((a, b) => b.data() - a.data());
      await fixture.whenStable();
      expect(getGrid()).toEqual([['c'], ['b'], ['a']]);
    });
  });

  describe('grouping', () => {
    beforeEach(async () => {
      component.secondaryAxisGroup.set((p) => p.data() % 2);
      await fixture.whenStable();
    });

    it('should group items', () => {
      expect(getGrid()).toEqual([['b'], ['a', 'c']]);
    });
    it('should order items on secondary axis by provided function', async () => {
      component.secondaryAxisOrder.set((a, b) => b.data() - a.data());
      await fixture.whenStable();
      expect(getGrid()).toEqual([['b'], ['c', 'a']]);
    });
  });
});
