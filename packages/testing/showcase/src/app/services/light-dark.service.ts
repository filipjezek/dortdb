import { effect, Injectable, signal } from '@angular/core';

const THEME_KEY = 'theme';

@Injectable({
  providedIn: 'root',
})
export class LightDarkService {
  private _isDarkTheme = signal(false);
  public isDarkTheme = this._isDarkTheme.asReadonly();
  prismLink = this.createPrismLink();

  constructor() {
    const ls = localStorage.getItem(THEME_KEY);
    if (ls) {
      this._isDarkTheme.set(ls === 'dark');
    } else {
      this._isDarkTheme.set(matchMedia('(prefers-color-scheme: dark)').matches);
    }

    effect(() => {
      this.applyToBody();
    });
  }

  private createPrismLink() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `prism-${this.isDarkTheme() ? 'dark' : 'light'}.css`;
    document.head.appendChild(link);
    return link;
  }

  toggleTheme() {
    this._isDarkTheme.update((val) => !val);
    localStorage.setItem(THEME_KEY, this.isDarkTheme() ? 'dark' : 'light');
  }
  private applyToBody() {
    const dark = this.isDarkTheme();

    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light', !dark);
    if (this.prismLink) {
      this.prismLink.href = this.prismLink.href.replace(
        dark ? 'light' : 'dark',
        dark ? 'dark' : 'light',
      );
    }
  }
}
