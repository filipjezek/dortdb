import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DSCell, DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { CommonModule } from '@angular/common';
import { PropertyBagComponent } from '../property-bag/property-bag.component';

@Component({
  selector: 'dort-cell-keyvalue',
  templateUrl: './cell-keyvalue.component.html',
  styleUrls: ['./cell-keyvalue.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, PropertyBagComponent],
})
export class CellKeyvalueComponent
  implements DSCell<Record<string, number | string | boolean>>
{
  public value = inject(DSCELL_VAL);
}
