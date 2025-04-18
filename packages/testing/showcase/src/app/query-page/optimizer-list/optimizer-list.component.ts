import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatListItemIcon,
  MatListOption,
  MatSelectionList,
} from '@angular/material/list';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PatternRule, PatternRuleConstructor } from '@dortdb/core/optimizer';
import { MatIcon } from '@angular/material/icon';

export interface OptimizerListItem {
  enabled: boolean;
  value: PatternRule | PatternRuleConstructor;
  name: string;
}

@Component({
  selector: 'dort-optimizer-list',
  imports: [
    CommonModule,
    MatSelectionList,
    MatListOption,
    MatListItemIcon,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    MatIcon,
  ],
  templateUrl: './optimizer-list.component.html',
  styleUrl: './optimizer-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OptimizerListComponent),
      multi: true,
    },
  ],
})
export class OptimizerListComponent implements ControlValueAccessor {
  onTouchedCb: () => void = () => {};
  private onChangeCb: (value: OptimizerListItem[]) => void = () => {};
  disabled = signal(false);
  items = signal<OptimizerListItem[]>([]);

  writeValue(obj: OptimizerListItem[]): void {
    this.items.set(obj);
  }
  registerOnChange(fn: any): void {
    this.onChangeCb = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouchedCb = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  handleCheckbox(item: OptimizerListItem, value: boolean) {
    item.enabled = value;
    this.onChangeCb(this.items());
    this.onTouchedCb();
  }

  handleDragDrop(event: CdkDragDrop<OptimizerListItem[]>) {
    moveItemInArray(this.items(), event.previousIndex, event.currentIndex);
    this.onChangeCb(this.items());
  }
}
