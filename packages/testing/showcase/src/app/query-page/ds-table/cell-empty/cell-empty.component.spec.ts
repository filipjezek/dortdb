import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellEmptyComponent } from './cell-empty.component';

describe('CellEmptyComponent', () => {
  let component: CellEmptyComponent;
  let fixture: ComponentFixture<CellEmptyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CellEmptyComponent ]
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
