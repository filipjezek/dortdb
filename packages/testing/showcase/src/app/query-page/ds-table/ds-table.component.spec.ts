import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DsTableComponent } from './ds-table.component';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { CellGenericComponent } from './cell-generic/cell-generic.component';
import { CellEmptyComponent } from './cell-empty/cell-empty.component';
import { CellObjectComponent } from './cell-object/cell-object.component';
import { CellKeyvalueComponent } from './cell-keyvalue/cell-keyvalue.component';
import { DsRowDirective } from './ds-row.directive';

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
      imports: [
        DsTableComponent,
        CellGenericComponent,
        CellEmptyComponent,
        CellObjectComponent,
        CellKeyvalueComponent,
        MultiviewStub,
        MultiviewPartitionStub,
        DsRowDirective,
      ],
    })
      .overrideComponent(DsTableComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DsTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });
});
