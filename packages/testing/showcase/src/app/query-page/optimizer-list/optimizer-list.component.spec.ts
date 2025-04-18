import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptimizerListComponent } from './optimizer-list.component';

describe('OptimizerListComponent', () => {
  let component: OptimizerListComponent;
  let fixture: ComponentFixture<OptimizerListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptimizerListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OptimizerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
