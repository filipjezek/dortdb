import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GhButtonComponent } from './gh-button.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('GhButtonComponent', () => {
  let component: GhButtonComponent;
  let fixture: ComponentFixture<GhButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GhButtonComponent],
    })
      .overrideComponent(GhButtonComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(GhButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
