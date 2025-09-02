import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { LightDarkService } from '../services/light-dark.service';

@Component({
  selector: 'dort-light-toggle',
  imports: [CommonModule, MatIcon, MatIconButton],
  templateUrl: './light-toggle.component.html',
  styleUrl: './light-toggle.component.scss',
})
export class LightToggleComponent {
  service = inject(LightDarkService);
}
