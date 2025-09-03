import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'dort-gh-button',
  imports: [CommonModule, MatButtonModule],
  templateUrl: './gh-button.component.html',
  styleUrl: './gh-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhButtonComponent {}
