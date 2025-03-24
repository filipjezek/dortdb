import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  InjectionToken,
} from '@angular/core';

export interface DSCell<T> {
  value: T;
}

export const DSCELL_VAL = new InjectionToken<any>('ds table cell value', {
  factory: () => null,
});

@Component({
  selector: 'dort-cell-generic',
  templateUrl: './cell-generic.component.html',
  styleUrls: ['./cell-generic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class CellGenericComponent implements DSCell<unknown> {
  public value = inject(DSCELL_VAL);
}
