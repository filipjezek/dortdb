import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DSCell, DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dort-cell-list',
  templateUrl: './cell-list.component.html',
  styleUrls: ['./cell-list.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellListComponent implements DSCell<unknown[]> {
  public value = inject(DSCELL_VAL);

  isObject(value: unknown) {
    return typeof value === 'object' || value === undefined || value === null;
  }
}
