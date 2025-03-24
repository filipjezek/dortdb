import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellListComponent } from './cell-list.component';
import { DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CellListComponent', () => {
  let component: CellListComponent;
  let fixture: ComponentFixture<CellListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CellListComponent],
      providers: [{ provide: DSCELL_VAL, useValue: ['a', 'b'] }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CellListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
