import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'dort-multiview-toggle',
  templateUrl: './multiview-toggle.component.html',
  styleUrls: ['./multiview-toggle.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class MultiviewToggleComponent {}
