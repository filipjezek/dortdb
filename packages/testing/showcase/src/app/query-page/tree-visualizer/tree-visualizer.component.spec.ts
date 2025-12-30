import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeVisualizerComponent } from './tree-visualizer.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('TreeVisualizerComponent', () => {
  let component: TreeVisualizerComponent;
  let fixture: ComponentFixture<TreeVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeVisualizerComponent],
    })
      .overrideComponent(TreeVisualizerComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TreeVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
