import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiviewPartitionComponent } from './multiview-partition.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('MultiviewPartitionComponent', () => {
  let component: MultiviewPartitionComponent;
  let fixture: ComponentFixture<MultiviewPartitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiviewPartitionComponent],
    })
      .overrideComponent(MultiviewPartitionComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MultiviewPartitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
