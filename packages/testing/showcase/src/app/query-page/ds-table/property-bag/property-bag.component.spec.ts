import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyBagComponent } from './property-bag.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { KeyValuePipe } from '@angular/common';

describe('PropertyBagComponent', () => {
  let component: PropertyBagComponent;
  let fixture: ComponentFixture<PropertyBagComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyBagComponent],
    })
      .overrideComponent(PropertyBagComponent, {
        set: {
          imports: [KeyValuePipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PropertyBagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
