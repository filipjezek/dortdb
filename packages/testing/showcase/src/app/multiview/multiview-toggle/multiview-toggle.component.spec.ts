import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiviewToggleComponent } from './multiview-toggle.component';

describe('MultiviewToggleComponent', () => {
  let component: MultiviewToggleComponent;
  let fixture: ComponentFixture<MultiviewToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MultiviewToggleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MultiviewToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
