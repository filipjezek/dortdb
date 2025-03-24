import { DsRowDirective } from './ds-row.directive';

describe('DsRowDirective', () => {
  it('should create an instance', () => {
    // the directive itself should not do anything, it is only an injectable container
    const directive = new DsRowDirective(null, null);
    expect(directive).toBeTruthy();
  });
});
