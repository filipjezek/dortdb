import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DSCell, DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dort-cell-object',
  templateUrl: './cell-object.component.html',
  styleUrls: ['./cell-object.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellObjectComponent implements DSCell<unknown> {
  public value = inject(DSCELL_VAL);
}
