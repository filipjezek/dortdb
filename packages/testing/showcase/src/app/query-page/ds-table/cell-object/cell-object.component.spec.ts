import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellObjectComponent } from './cell-object.component';

describe('CellObjectComponent', () => {
  let component: CellObjectComponent;
  let fixture: ComponentFixture<CellObjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CellObjectComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CellObjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
