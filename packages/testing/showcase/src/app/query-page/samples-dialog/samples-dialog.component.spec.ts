import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SamplesDialogComponent } from './samples-dialog.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('SamplesDialogComponent', () => {
  let component: SamplesDialogComponent;
  let fixture: ComponentFixture<SamplesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SamplesDialogComponent],
    })
      .overrideComponent(SamplesDialogComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SamplesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
