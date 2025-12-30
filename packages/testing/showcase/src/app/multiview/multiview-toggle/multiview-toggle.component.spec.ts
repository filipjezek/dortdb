import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiviewToggleComponent } from './multiview-toggle.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('MultiviewToggleComponent', () => {
  let component: MultiviewToggleComponent;
  let fixture: ComponentFixture<MultiviewToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiviewToggleComponent],
    })
      .overrideComponent(MultiviewToggleComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
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
