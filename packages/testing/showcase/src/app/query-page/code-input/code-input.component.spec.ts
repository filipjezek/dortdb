import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeInputComponent } from './code-input.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CodeInputComponent', () => {
  let component: CodeInputComponent;
  let fixture: ComponentFixture<CodeInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeInputComponent],
    })
      .overrideComponent(CodeInputComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CodeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
