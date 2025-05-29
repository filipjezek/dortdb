import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellNodeComponent } from './cell-node.component';

describe('CellNodeComponent', () => {
  let component: CellNodeComponent;
  let fixture: ComponentFixture<CellNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellNodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CellNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
