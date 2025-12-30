import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryDialogComponent } from './history-dialog.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

describe('HistoryDialogComponent', () => {
  let component: HistoryDialogComponent;
  let fixture: ComponentFixture<HistoryDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: { items: [] } }],
    })
      .overrideComponent(HistoryDialogComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HistoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
