import { ComponentFixture, TestBed } from '@angular/core/testing';

vi.mock('@dortdb/lang-cypher', () => ({
  ConnectionIndex: {} as any,
  Cypher: () => ({ name: '', visitors: {} }) as any,
  gaLabelsOrType: 'gaLabelsOrType',
  GraphologyDataAdapter: class {},
}));
vi.mock('@dortdb/lang-sql', () => ({
  SQL: () => ({ name: '', visitors: {} }) as any,
}));
vi.mock('@dortdb/lang-xquery', () => ({
  XQuery: () => ({ name: '', visitors: {} }) as any,
}));

import { QueryPageComponent } from './query-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('QueryPageComponent', () => {
  let component: QueryPageComponent;
  let fixture: ComponentFixture<QueryPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryPageComponent],
    })
      .overrideComponent(QueryPageComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(QueryPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
