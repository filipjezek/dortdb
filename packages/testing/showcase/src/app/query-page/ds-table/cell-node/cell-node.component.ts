import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DSCell, DSCELL_VAL } from '../cell-generic/cell-generic.component';

@Component({
  selector: 'dort-cell-node',
  imports: [CommonModule],
  templateUrl: './cell-node.component.html',
  styleUrl: './cell-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellNodeComponent implements DSCell<unknown> {
  public value = inject<Node>(DSCELL_VAL);
  valueAsString = new XMLSerializer().serializeToString(this.value);
}
