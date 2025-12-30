import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellGenericComponent } from './cell-generic.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CellGenericComponent', () => {
  let component: CellGenericComponent;
  let fixture: ComponentFixture<CellGenericComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellGenericComponent],
    })
      .overrideComponent(CellGenericComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellGenericComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
