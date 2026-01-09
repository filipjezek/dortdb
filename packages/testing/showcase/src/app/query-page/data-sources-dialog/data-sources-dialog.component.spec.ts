vi.mock('@dortdb/lang-cypher', () => ({
  ConnectionIndex: {} as any,
  Cypher: () => ({ name: '', visitors: {} }) as any,
  gaLabelsOrType: 'gaLabelsOrType',
  GraphologyDataAdapter: class {},
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourcesDialogComponent } from './data-sources-dialog.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DecimalPipe } from '@angular/common';

describe('DataSourcesDialogComponent', () => {
  let component: DataSourcesDialogComponent;
  let fixture: ComponentFixture<DataSourcesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSourcesDialogComponent],
    })
      .overrideComponent(DataSourcesDialogComponent, {
        set: {
          imports: [DecimalPipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataSourcesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
