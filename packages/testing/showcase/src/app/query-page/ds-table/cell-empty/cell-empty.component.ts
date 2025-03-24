import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'dort-cell-empty',
  templateUrl: './cell-empty.component.html',
  styleUrls: ['./cell-empty.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class CellEmptyComponent {}
