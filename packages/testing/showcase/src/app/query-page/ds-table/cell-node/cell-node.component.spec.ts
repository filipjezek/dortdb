import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellNodeComponent } from './cell-node.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DSCELL_VAL } from '../cell-generic/cell-generic.component';

describe('CellNodeComponent', () => {
  let component: CellNodeComponent;
  let fixture: ComponentFixture<CellNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellNodeComponent],
      providers: [
        { provide: DSCELL_VAL, useValue: document.createTextNode('') },
      ],
    })
      .overrideComponent(CellNodeComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
