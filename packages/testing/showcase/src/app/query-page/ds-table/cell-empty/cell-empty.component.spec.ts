import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellEmptyComponent } from './cell-empty.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CellEmptyComponent', () => {
  let component: CellEmptyComponent;
  let fixture: ComponentFixture<CellEmptyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellEmptyComponent],
    })
      .overrideComponent(CellEmptyComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellEmptyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
