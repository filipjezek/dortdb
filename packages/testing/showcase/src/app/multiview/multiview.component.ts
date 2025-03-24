import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { MultiviewPartitionComponent } from './multiview-partition/multiview-partition.component';
import { takeUntil, withLatestFrom } from 'rxjs';
import { GlobalEventService } from '../services/global-event.service';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';

export type OrderingFn = (
  a: MultiviewPartitionComponent,
  b: MultiviewPartitionComponent,
) => number;
export type GroupingFn = (
  partition: MultiviewPartitionComponent,
  index: number,
) => any;

const returnZero = () => 0;
const returnIndex = (p: MultiviewPartitionComponent, i: number) => i;

@Component({
  selector: 'dort-multiview',
  templateUrl: './multiview.component.html',
  styleUrls: ['./multiview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  host: {
    '[class.vertical]': 'vertical()',
  },
})
export class MultiviewComponent implements AfterViewInit {
  readonly mainAxisOrder = input<OrderingFn>();
  readonly secondaryAxisOrder = input<OrderingFn>();
  readonly secondaryAxisGroup = input<GroupingFn>();

  private gEventS = inject(GlobalEventService);
  private changeDetector = inject(ChangeDetectorRef);

  /**
   * size basis of groups
   */
  readonly ratios = model<number[]>();
  /**
   * is size basis a percentage or number of pixels
   */
  readonly relativeRatios = input<boolean>(true);
  /**
   * default row size when size basis is number of pixels
   */
  readonly defaultGroupSize = input<number>(100);
  /**
   * is the main axis vertical or horizontal?
   */
  readonly vertical = input<boolean>(false);

  private readonly partitionComponents = contentChildren(
    MultiviewPartitionComponent,
  );

  partitionGrid = computed<MultiviewPartitionComponent[][]>(() =>
    this.createPartitionGrid(),
  );
  partitionGrid$ = toObservable(this.partitionGrid);

  constructor() {
    effect(() => {
      if (this.partitionComponents().length > 0) {
        const grid = this.partitionGrid();
        if (this.ratios().length !== grid.length) {
          const initialRatios = Array(grid.length).fill(
            this.relativeRatios() ? 100 / grid.length : this.defaultGroupSize(),
          );
          this.ratios.set(initialRatios);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.changeDetector.markForCheck();
  }

  private createPartitionGrid() {
    const partitions = this.partitionComponents();
    const xOrder = this.mainAxisOrder() ?? returnZero;
    const yOrder = this.secondaryAxisOrder() ?? returnZero;
    const yGroup = this.secondaryAxisGroup() ?? returnIndex;
    return Object.values(Object.groupBy(Array.from(partitions), yGroup))
      .map((p) => p.sort(yOrder))
      .sort((a, b) => xOrder(a[0], b[0]));
  }

  startDrag(initE: MouseEvent, index: number) {
    initE.preventDefault();
    const second = (initE.target as HTMLElement).closest(
      '.group',
    ) as HTMLElement;
    const first = second.previousElementSibling as HTMLElement;
    const ratios = this.ratios();
    const vertical = this.vertical();

    const totalPct = ratios[index] + ratios[index - 1];
    const initialFirstSize = vertical ? first.clientHeight : first.clientWidth;
    const totalSize =
      (vertical ? second.clientHeight : second.clientWidth) + initialFirstSize;

    this.gEventS.mouseMove
      .pipe(
        withLatestFrom(this.partitionGrid$),
        takeUntil(this.gEventS.mouseReleased),
      )
      .subscribe(([e, columns]) => {
        e.preventDefault();
        let firstSize =
          initialFirstSize + (this.vertical() ? e.y - initE.y : e.x - initE.x);
        const min = MultiviewPartitionComponent.minSize;
        const ratios = [...this.ratios()];

        if (this.relativeRatios()) {
          firstSize = Math.max(min, Math.min(firstSize, totalSize - min));
          this.notifyVisibilityChanges(index, columns, firstSize, totalSize);
          ratios[index - 1] = totalPct * (firstSize / totalSize);
          ratios[index] = totalPct - ratios[index - 1];
        } else {
          firstSize = Math.max(min, firstSize);
          this.notifyVisibilityChanges(index, columns, firstSize, totalSize);
          ratios[index - 1] = firstSize;
        }

        this.ratios.set(ratios);
        this.changeDetector.markForCheck();
      });
  }

  private notifyVisibilityChanges(
    index: number,
    columns: MultiviewPartitionComponent[][],
    firstSize: number,
    totalSize: number,
  ) {
    const min = 2 * MultiviewPartitionComponent.minSize;
    const ratios = this.ratios();
    let initialFirstSize = ratios[index];
    if (this.relativeRatios()) {
      initialFirstSize =
        (ratios[index - 1] * totalSize) / (ratios[index] + ratios[index - 1]);
    }
    if (firstSize >= min && initialFirstSize < min) {
      columns[index - 1].forEach((col) => col.visible.emit(true));
    } else if (firstSize < min && initialFirstSize >= min) {
      columns[index - 1].forEach((col) => col.visible.emit(false));
    }
    if (totalSize - firstSize >= min && totalSize - initialFirstSize < min) {
      columns[index].forEach((col) => col.visible.emit(true));
    } else if (
      totalSize - firstSize < min &&
      totalSize - initialFirstSize >= min
    ) {
      columns[index].forEach((col) => col.visible.emit(false));
    }
  }
}
