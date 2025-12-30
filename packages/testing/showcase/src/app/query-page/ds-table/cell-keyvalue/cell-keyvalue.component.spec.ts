import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellKeyvalueComponent } from './cell-keyvalue.component';
import { DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CellKeyvalueComponent', () => {
  let component: CellKeyvalueComponent;
  let fixture: ComponentFixture<CellKeyvalueComponent>;
  let el: HTMLElement;
  const value: any = { foo: 'bar' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellKeyvalueComponent],
      providers: [{ provide: DSCELL_VAL, useValue: value }],
    })
      .overrideComponent(CellKeyvalueComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellKeyvalueComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });
});
