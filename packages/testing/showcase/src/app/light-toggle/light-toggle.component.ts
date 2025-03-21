import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

const THEME_KEY = 'theme';

@Component({
  selector: 'dort-light-toggle',
  imports: [CommonModule, MatIcon, MatIconButton],
  templateUrl: './light-toggle.component.html',
  styleUrl: './light-toggle.component.scss',
})
export class LightToggleComponent {
  isDarkTheme: boolean;
  private prismLink: HTMLLinkElement;

  constructor() {
    this.prismLink = document.querySelector(
      'link[rel="stylesheet"][href*="prism"]',
    );
    const ls = localStorage.getItem(THEME_KEY);
    if (ls) {
      this.isDarkTheme = ls === 'dark';
      this.applyToBody();
    } else {
      this.isDarkTheme = matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem(THEME_KEY, this.isDarkTheme ? 'dark' : 'light');
    this.applyToBody();
  }
  private applyToBody() {
    document.body.classList.toggle('dark', this.isDarkTheme);
    document.body.classList.toggle('light', !this.isDarkTheme);
    if (this.prismLink) {
      this.prismLink.href = this.prismLink.href.replace(
        this.isDarkTheme ? 'light' : 'dark',
        this.isDarkTheme ? 'dark' : 'light',
      );
    }
  }
}
