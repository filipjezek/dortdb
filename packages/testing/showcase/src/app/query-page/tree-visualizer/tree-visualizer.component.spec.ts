import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeVisualizerComponent } from './tree-visualizer.component';

describe('TreeVisualizerComponent', () => {
  let component: TreeVisualizerComponent;
  let fixture: ComponentFixture<TreeVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeVisualizerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TreeVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
