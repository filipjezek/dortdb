import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  TemplateRef,
  ViewChild,
} from '@angular/core';

export type DragEventType = 'start' | 'drag' | 'end';
export interface DragEvent {
  type: DragEventType;
  src: MouseEvent;
}

@Component({
  selector: 'dort-multiview-partition',
  templateUrl: './multiview-partition.component.html',
  styleUrls: ['./multiview-partition.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiviewPartitionComponent {
  @ViewChild('content') public content: TemplateRef<any>;
  data = input<any>();
  visible = output<boolean>();

  public static minSize = 5;
}
