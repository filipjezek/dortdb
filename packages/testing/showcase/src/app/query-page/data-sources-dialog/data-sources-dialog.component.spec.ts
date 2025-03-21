import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSourcesDialogComponent } from './data-sources-dialog.component';

describe('DataSourcesDialogComponent', () => {
  let component: DataSourcesDialogComponent;
  let fixture: ComponentFixture<DataSourcesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSourcesDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataSourcesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
