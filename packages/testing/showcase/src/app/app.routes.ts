import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./query-page/query-page.component').then(
        (m) => m.QueryPageComponent
      ),
  },
];
