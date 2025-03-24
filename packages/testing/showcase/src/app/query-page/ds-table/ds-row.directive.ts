import { Directive, Injector, ViewContainerRef } from '@angular/core';

/**
 * This can be used from cells to get a reference to their parent row
 * (e.g. for inserting popups)
 */
@Directive({
  selector: '[dortDsRow]',
  exportAs: 'DsRow',
  standalone: true,
})
export class DsRowDirective {
  constructor(
    public viewContainer: ViewContainerRef,
    public injector: Injector,
  ) {}
}
