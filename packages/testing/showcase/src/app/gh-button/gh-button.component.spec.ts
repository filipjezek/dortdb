import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GhButtonComponent } from './gh-button.component';

describe('GhButtonComponent', () => {
  let component: GhButtonComponent;
  let fixture: ComponentFixture<GhButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GhButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GhButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
