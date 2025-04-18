import {
  animate,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { DortDB, LogicalPlanOperator, QueryResult } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
import { startWith } from 'rxjs';
import { lsSyncForm } from '../utils/ls-sync-form';
import { DataSourcesDialogComponent } from './data-sources-dialog/data-sources-dialog.component';
import { DsTableComponent } from './ds-table/ds-table.component';
import { History } from './history';
import { HistoryDialogComponent } from './history-dialog/history-dialog.component';
import {
  Sample,
  SamplesDialogComponent,
} from './samples-dialog/samples-dialog.component';
import { TreeVisualizerComponent } from './tree-visualizer/tree-visualizer.component';
import {
  mergeFromToItems,
  mergeToFromItems,
  ProjConcatToJoin,
  PushdownSelections,
  removeEmptyProjConcat,
} from '@dortdb/core/optimizer';
import {
  OptimizerListComponent,
  OptimizerListItem,
} from './optimizer-list/optimizer-list.component';

@Component({
  selector: 'dort-query-page',
  imports: [
    CommonModule,
    TreeVisualizerComponent,
    ReactiveFormsModule,
    MatSelect,
    MatOption,
    MatFormFieldModule,
    MatButtonModule,
    MatCardModule,
    MatCheckbox,
    DsTableComponent,
    OptimizerListComponent,
  ],
  templateUrl: './query-page.component.html',
  styleUrl: './query-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ width: 0, overflow: 'hidden' }),
        query(':scope > *', style({ opacity: 0 })),
        animate('0.15s ease-out', style({ width: '*' })),
        query(
          ':scope > *',
          animate('0.25s ease-in-out', style({ opacity: 1 })),
        ),
      ]),
      transition(':leave', [
        style({ width: '*' }),
        query(':scope > *', animate('0.05s ease-in', style({ opacity: 0 }))),
        query(':scope > *', style({ opacity: 0 })),
        animate('0.05s 0.05s ease-in', style({ width: 0 })),
      ]),
    ]),
  ],
})
export class QueryPageComponent {
  private readonly db = new DortDB({
    mainLang: SQL(),
    additionalLangs: [XQuery(), Cypher({ defaultGraph: 'defaultGraph' })],
    optimizer: {
      rules: [],
    },
  });
  private queryHistory = new History<string>(20);
  private dialogS = inject(MatDialog);
  private allOptimizations: OptimizerListItem[] = [
    { name: 'merge to-from items', value: mergeToFromItems, enabled: true },
    { name: 'merge from-to items', value: mergeFromToItems, enabled: true },
    {
      name: 'pushdown selections',
      value: PushdownSelections,
      enabled: true,
    },
    {
      name: 'remove empty projection concat',
      value: removeEmptyProjConcat,
      enabled: true,
    },
    {
      name: 'projection concat to join',
      value: ProjConcatToJoin,
      enabled: true,
    },
  ];

  optimizerOptions = new FormGroup({
    enabled: new FormControl(false),
    optimizations: new FormControl(this.allOptimizations),
  });
  form = new FormGroup({
    lang: new FormControl<'sql' | 'xquery' | 'cypher'>('sql'),
    query: new FormControl<string>('', Validators.required),
    dataSources: new FormGroup({
      defaultGraph: new FormControl(true),
    }),
    optimizerSettings: new FormControl(false),
  });
  plan: LogicalPlanOperator;
  output: QueryResult;
  error: Error;

  constructor() {
    lsSyncForm('query-page-form', this.form);
    this.optimizerOptions.valueChanges
      .pipe(startWith(this.optimizerOptions.value), takeUntilDestroyed())
      .subscribe((options) => {
        if (options.enabled) {
          this.db.optimizer.reconfigure({
            rules: options.optimizations
              .filter((x) => x.enabled)
              .map((x) => x.value),
          });
        } else {
          this.db.optimizer.reconfigure({ rules: [] });
        }
      });
  }

  parse() {
    const formVal = this.form.value;
    this.error = null;
    this.output = null;
    this.queryHistory.push(formVal.query);
    try {
      const ast = this.db.parse(formVal.query, {
        mainLang: formVal.lang,
      });
      console.log(ast);
      this.plan = this.db.buildPlan(ast.value[0], {
        mainLang: formVal.lang,
      });
      console.log(this.plan);
    } catch (err) {
      this.plan = null;
      this.error = err as Error;
      console.error(err);
    }
  }

  execute() {
    const formVal = this.form.value;
    this.error = null;
    this.plan = null;
    this.output = null;
    this.queryHistory.push(formVal.query);
    try {
      this.output = this.db.query(formVal.query, { mainLang: formVal.lang });
    } catch (err) {
      this.error = err as Error;
      console.error(err);
    }
  }

  openHistory() {
    const ref = this.dialogS.open(HistoryDialogComponent, {
      autoFocus: 'dialog',
      data: this.queryHistory,
      width: '80vw',
      minWidth: '60vw',
    });
    ref.afterClosed().subscribe((query) => {
      if (!query) return;
      this.form.get('query').setValue(query);
      this.queryHistory.push(query);
    });
  }

  openSamples() {
    const ref = this.dialogS.open(SamplesDialogComponent, {
      autoFocus: 'dialog',
      width: '80vw',
      minWidth: '60vw',
      height: '80vh',
    });
    ref.afterClosed().subscribe((query: Sample) => {
      if (!query) return;
      this.form.get('lang').setValue(query.lang);
      this.form.get('query').setValue(query.query);
      this.queryHistory.push(query.query);
    });
  }

  openDataSources() {
    const ref = this.dialogS.open(DataSourcesDialogComponent, {
      autoFocus: 'dialog',
      width: '80vw',
      minWidth: '60vw',
    });
  }
}
