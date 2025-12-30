import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellHeaderComponent } from './cell-header.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CellHeaderComponent', () => {
  let component: CellHeaderComponent;
  let fixture: ComponentFixture<CellHeaderComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellHeaderComponent],
    })
      .overrideComponent(CellHeaderComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
