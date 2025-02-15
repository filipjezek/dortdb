import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { LightToggleComponent } from './light-toggle/light-toggle.component';

@Component({
  imports: [RouterModule, MatToolbar, LightToggleComponent],
  selector: 'dort-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'showcase';
}
