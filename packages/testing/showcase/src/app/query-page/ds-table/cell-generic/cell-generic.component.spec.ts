import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellGenericComponent } from './cell-generic.component';

describe('CellGenericComponent', () => {
  let component: CellGenericComponent;
  let fixture: ComponentFixture<CellGenericComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CellGenericComponent ]
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
