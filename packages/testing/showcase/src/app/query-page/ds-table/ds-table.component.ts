import {
  Component,
  computed,
  Injector,
  input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { isEqual } from 'lodash-es';
import {
  CellGenericComponent,
  DSCell,
  DSCELL_VAL,
} from './cell-generic/cell-generic.component';
import { CellKeyvalueComponent } from './cell-keyvalue/cell-keyvalue.component';
import { CellListComponent } from './cell-list/cell-list.component';
import { CellObjectComponent } from './cell-object/cell-object.component';
import { CommonModule } from '@angular/common';
import { CellEmptyComponent } from './cell-empty/cell-empty.component';
import { CellHeaderComponent } from './cell-header/cell-header.component';
import { DsRowDirective } from './ds-row.directive';
import { isPrimitive } from '../../utils/is-primitive';
import { MatCheckbox } from '@angular/material/checkbox';
import { MultiviewComponent } from '../../multiview/multiview.component';
import { MultiviewPartitionComponent } from '../../multiview/multiview-partition/multiview-partition.component';
import { MatPaginator } from '@angular/material/paginator';
import { CellNodeComponent } from './cell-node/cell-node.component';

export enum ColType {
  string,
  number,
  object,
  array,
  boolean,
  keyvalue,
  node,
}

@Component({
  selector: 'dort-ds-table',
  templateUrl: './ds-table.component.html',
  styleUrls: ['./ds-table.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    CellEmptyComponent,
    CellHeaderComponent,
    DsRowDirective,
    MatCheckbox,
    ReactiveFormsModule,
    MultiviewComponent,
    MultiviewPartitionComponent,
    MatPaginator,
  ],
})
export class DsTableComponent implements OnChanges {
  readonly rowHeight = input(47);
  readonly src = input<any[]>([]);
  readonly keys = input<string[]>([], {});

  colSizes: number[] = [];
  readonly ColType = ColType;
  readonly cellTypes: Record<ColType, new (...args: any) => DSCell<any>> = {
    [ColType.array]: CellListComponent,
    [ColType.boolean]: CellGenericComponent,
    [ColType.keyvalue]: CellKeyvalueComponent,
    [ColType.number]: CellGenericComponent,
    [ColType.object]: CellObjectComponent,
    [ColType.string]: CellGenericComponent,
    [ColType.node]: CellNodeComponent,
  };

  readonly clampRowsControl = new FormControl<boolean>(true);
  readonly page = signal(0);
  readonly pageSize = signal(20);
  readonly currPageRows = computed(() => {
    const page = this.page();
    const pageSize = this.pageSize();
    return this.src().slice(page * pageSize, (page + 1) * pageSize);
  });

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('src' in changes) {
      const change = changes['src'];
      if (!change.currentValue?.length) {
        this.colSizes = [];
        return;
      }
      if (change.currentValue.length != change.previousValue?.length) {
        this.page.set(0);
      }
    }
    if (
      'keys' in changes &&
      !isEqual(changes['keys'].currentValue, changes['keys'].previousValue)
    ) {
      const length = changes['keys'].currentValue.length;
      this.colSizes = Array(length).fill(100 / length);
      this.page.set(0);
    }
  }

  ceil(num: number) {
    return Math.ceil(num);
  }

  getInjector(value: any, parent: Injector) {
    return Injector.create({
      providers: [{ provide: DSCELL_VAL, useValue: value }],
      parent,
    });
  }

  isEmpty(val: unknown) {
    return (
      val === null ||
      val === '' ||
      val === undefined ||
      isEqual(val, []) ||
      isEqual(val, {})
    );
  }

  getColType(value: unknown): ColType {
    switch (typeof value) {
      case 'boolean':
        return ColType.boolean;
      case 'number':
        return ColType.number;
      case 'string':
        return ColType.string;
      default:
        break;
    }
    if (value instanceof Array) {
      return ColType.array;
    }
    if (value instanceof Node) {
      return ColType.node;
    }
    if (value instanceof Date) {
      return ColType.string;
    }
    if (value === null) {
      return ColType.object;
    }
    if (Object.values(value).every((val) => isPrimitive(val))) {
      return ColType.keyvalue;
    }
    return ColType.object;
  }
}
