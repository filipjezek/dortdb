import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyBagComponent } from './property-bag.component';

describe('PropertyBagComponent', () => {
  let component: PropertyBagComponent;
  let fixture: ComponentFixture<PropertyBagComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PropertyBagComponent],
      imports: [],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyBagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
