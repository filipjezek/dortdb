import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SamplesDialogComponent } from './samples-dialog.component';

describe('SamplesDialogComponent', () => {
  let component: SamplesDialogComponent;
  let fixture: ComponentFixture<SamplesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SamplesDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SamplesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
