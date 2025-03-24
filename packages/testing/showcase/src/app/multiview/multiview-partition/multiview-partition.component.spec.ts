import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiviewPartitionComponent } from './multiview-partition.component';

describe('MultiviewPartitionComponent', () => {
  let component: MultiviewPartitionComponent;
  let fixture: ComponentFixture<MultiviewPartitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MultiviewPartitionComponent ]
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
