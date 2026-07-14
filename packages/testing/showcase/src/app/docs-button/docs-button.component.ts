import { Component } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'dort-docs-button',
  imports: [MatIconButton, MatIcon],
  templateUrl: './docs-button.component.html',
  styleUrl: './docs-button.component.scss',
})
export class DocsButtonComponent {}
