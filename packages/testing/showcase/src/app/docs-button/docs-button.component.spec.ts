import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocsButtonComponent } from './docs-button.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('DocsButtonComponent', () => {
  let component: DocsButtonComponent;
  let fixture: ComponentFixture<DocsButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsButtonComponent],
    })
      .overrideComponent(DocsButtonComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DocsButtonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
