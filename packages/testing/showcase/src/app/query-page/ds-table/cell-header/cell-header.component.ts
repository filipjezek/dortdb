import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'dort-cell-header',
  templateUrl: './cell-header.component.html',
  styleUrls: ['./cell-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class CellHeaderComponent {
  key = input<string>();
}
