import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellKeyvalueComponent } from './cell-keyvalue.component';
import { DSCELL_VAL } from '../cell-generic/cell-generic.component';
import { DsRowDirective } from '../ds-row.directive';
import { PurefnPipe } from 'src/app/widgets/pipes/purefn.pipe';
import { NO_ERRORS_SCHEMA, ViewContainerRef } from '@angular/core';

describe('CellKeyvalueComponent', () => {
  let component: CellKeyvalueComponent;
  let fixture: ComponentFixture<CellKeyvalueComponent>;
  let el: HTMLElement;
  let nameEl: HTMLElement;
  const value: any = { foo: 'bar' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CellKeyvalueComponent, PurefnPipe],
      providers: [
        { provide: DSCELL_VAL, useValue: value },
        {
          provide: DsRowDirective,
          useValue: {
            viewContainer: jasmine.createSpyObj('ViewContainerRef', [
              'insert',
              'detach',
            ]),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CellKeyvalueComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should show property bag when name does not exist', () => {
    fixture.detectChanges();
    expect(el.querySelector('.name')).toBeFalsy();
    expect(el.querySelector('dort-property-bag')).toBeTruthy();
  });

  describe('with name', () => {
    let viewRef: jasmine.SpyObj<ViewContainerRef>;

    beforeEach(() => {
      value.name = 'test';
      fixture.detectChanges();
      viewRef = TestBed.inject(DsRowDirective).viewContainer as any;
      (viewRef as any).element = { nativeElement: el };
      nameEl = el.querySelector('.name');
    });

    afterEach(() => {
      delete value.name;
    });

    it('should show only name', () => {
      expect(nameEl).toBeTruthy();
      expect(el.querySelector('dort-property-bag')).toBeFalsy();
    });

    it('should show popup on mouseenter', () => {
      nameEl.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(viewRef.insert).toHaveBeenCalled();
    });
  });
});
