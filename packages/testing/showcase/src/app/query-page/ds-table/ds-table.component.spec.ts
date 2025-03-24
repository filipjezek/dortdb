import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColType, DsTableComponent, getColType } from './ds-table.component';
import { LinkWrapper } from '../sql/user-sql-functions/make-link';
import { Component, NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { CellGenericComponent } from './cell-generic/cell-generic.component';
import { CellEmptyComponent } from './cell-empty/cell-empty.component';
import { CellObjectComponent } from './cell-object/cell-object.component';
import { CellKeyvalueComponent } from './cell-keyvalue/cell-keyvalue.component';
import { CellLinkComponent } from './cell-link/cell-link.component';
import { By } from '@angular/platform-browser';
import { PurefnPipe } from 'src/app/widgets/pipes/purefn.pipe';
import { DsRowDirective } from './ds-row.directive';
import { Store } from '@ngrx/store';
import { StoreStub } from 'src/app/testing/store.stub';

@Component({
  template: `<ng-content></ng-content>`,
  selector: 'dort-multiview',
})
class MultiviewStub {}
@Component({
  template: `<ng-content></ng-content>`,
  selector: 'dort-multiview-partition',
})
class MultiviewPartitionStub {}

describe('DsTableComponent', () => {
  let component: DsTableComponent;
  let fixture: ComponentFixture<DsTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        DsTableComponent,
        CellGenericComponent,
        CellEmptyComponent,
        CellObjectComponent,
        CellKeyvalueComponent,
        CellLinkComponent,
        MultiviewStub,
        MultiviewPartitionStub,
        PurefnPipe,
        DsRowDirective,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: Store, useClass: StoreStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(DsTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should create correct schema', () => {
    component.src = [
      [1, 'test', true, [], { foo: 'bar' }, new LinkWrapper(1)],
      [2, 'test2', false, ['a', 'b'], { foo: 'bar2' }, new LinkWrapper(2)],
    ];
    component.keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    component.ngOnChanges({
      src: new SimpleChange(undefined, component.src, true),
    });
    fixture.detectChanges();

    const de = fixture.debugElement;
    const rows = de.queryAll(By.css('dort-multiview'));
    const cells = rows.map((row) =>
      row
        .queryAll(By.css('dort-multiview-partition'))
        .map((c) => (c.nativeElement as HTMLElement).firstElementChild.tagName),
    );
    expect(cells).toEqual([
      [
        'DORT-CELL-HEADER',
        'DORT-CELL-HEADER',
        'DORT-CELL-HEADER',
        'DORT-CELL-HEADER',
        'DORT-CELL-HEADER',
        'DORT-CELL-HEADER',
      ],
      [
        'DORT-CELL-GENERIC',
        'DORT-CELL-GENERIC',
        'DORT-CELL-GENERIC',
        'DORT-CELL-EMPTY',
        'DORT-CELL-KEYVALUE',
        'DORT-CELL-LINK',
      ],
      [
        'DORT-CELL-GENERIC',
        'DORT-CELL-GENERIC',
        'DORT-CELL-GENERIC',
        'DORT-CELL-LIST',
        'DORT-CELL-KEYVALUE',
        'DORT-CELL-LINK',
      ],
    ]);
  });
});

describe('getColType', () => {
  it('should detect a string column', () => {
    expect(getColType('test')).toBe(ColType.string);
  });

  it('should detect a number column', () => {
    expect(getColType(1)).toBe(ColType.number);
  });

  it('should detect a boolean column', () => {
    expect(getColType(true)).toBe(ColType.boolean);
  });

  it('should detect an array column', () => {
    expect(getColType([])).toBe(ColType.array);
  });

  it('should detect an object column', () => {
    expect(getColType({ foo: { bar: 1 } })).toBe(ColType.object);
  });

  it('should detect a LinkWrapper column', () => {
    expect(getColType(new LinkWrapper(1))).toBe(ColType.link);
  });

  it('should detect an key-value column', () => {
    expect(getColType({ key: 'value' })).toBe(ColType.keyvalue);
  });
});
