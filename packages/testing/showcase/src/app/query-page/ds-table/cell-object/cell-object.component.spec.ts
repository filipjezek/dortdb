import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CellObjectComponent } from './cell-object.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { JsonPipe } from '@angular/common';

describe('CellObjectComponent', () => {
  let component: CellObjectComponent;
  let fixture: ComponentFixture<CellObjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellObjectComponent],
    })
      .overrideComponent(CellObjectComponent, {
        set: {
          imports: [JsonPipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CellObjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
