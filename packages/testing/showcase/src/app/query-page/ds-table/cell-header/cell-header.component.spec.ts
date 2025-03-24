import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellHeaderComponent } from './cell-header.component';
import { StoreStub } from 'src/app/testing/store.stub';
import { Store } from '@ngrx/store';
import { State } from 'src/app/store/reducers';
import {
  addCondition,
  sortByColumn,
} from 'src/app/store/actions/navigator.actions';
import { navigatorSelectors } from 'src/app/store/selectors/navigator.selectors';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DialogService } from 'src/app/services/dialog.service';
import { FilterDialogComponent } from '../filters/filter-dialog/filter-dialog.component';
import { ColType } from '../ds-table.component';

describe('CellHeaderComponent', () => {
  let component: CellHeaderComponent;
  let fixture: ComponentFixture<CellHeaderComponent>;
  let store: StoreStub<State>;
  let el: HTMLElement;

  beforeEach(async () => {
    spyOn(navigatorSelectors, 'selectOrderColumn').and.returnValue({
      asc: true,
      key: 'foo',
    });

    await TestBed.configureTestingModule({
      declarations: [CellHeaderComponent],
      providers: [
        { provide: Store, useClass: StoreStub },
        {
          provide: DialogService,
          useValue: jasmine.createSpyObj('DialogService', [
            'openUnattached',
            'close',
          ]),
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CellHeaderComponent);
    store = TestBed.inject(Store) as any;
    component = fixture.componentInstance;
    component.key = 'testkey';
    component.type = ColType.number;
    component.distinctValues = [1, 2, 3, 4, 5, 6];
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should sort data', () => {
    el.querySelector<HTMLElement>('.sort').click();
    fixture.detectChanges();
    expect(store.dispatch).toHaveBeenCalledWith(
      sortByColumn({ key: 'testkey', asc: true })
    );

    (
      navigatorSelectors.selectOrderColumn as any as jasmine.Spy
    ).and.returnValue({
      asc: true,
      key: 'testkey',
    });
    el.querySelector<HTMLElement>('.sort').click();
    fixture.detectChanges();
    expect(store.dispatch).toHaveBeenCalledWith(
      sortByColumn({ key: 'testkey', asc: false })
    );
  });

  describe('opening filter dialog', () => {
    let listener: (e: CustomEvent) => void;
    let dialogS: jasmine.SpyObj<DialogService>;
    let elref: any;

    beforeEach(() => {
      dialogS = TestBed.inject(DialogService) as jasmine.SpyObj<DialogService>;
      elref = {
        addEventListener: (type: string, cb: (e: CustomEvent) => void) => {
          if (type === 'value') {
            listener = cb;
          }
        },
        attach: () => {},
      };
      dialogS.openUnattached.and.returnValue(elref);
      el.querySelector<HTMLElement>('.filter').click();
      fixture.detectChanges();
    });

    it('should open the dialog', () => {
      expect(dialogS.openUnattached).toHaveBeenCalledWith(
        FilterDialogComponent
      );
      expect(elref.type).toBe(ColType.number);
      expect(elref.distinctValues).toEqual([1, 2, 3, 4, 5, 6]);
      expect(elref.key).toBe('testkey');
    });
    it('should filter the column', () => {
      listener({ detail: 'FOO = BAR' } as any);
      expect(store.dispatch).toHaveBeenCalledWith(
        addCondition({ condition: 'FOO = BAR', key: 'testkey' })
      );
    });
  });
});
