import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { DortDB, LogicalPlanOperator, QueryResult } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
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
import { MatCheckbox } from '@angular/material/checkbox';
import { transition, trigger, useAnimation } from '@angular/animations';
import { dropdownIn, dropdownOut } from '../animations';
import { optimizedPlan } from './optimized-plan';

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
  ],
  templateUrl: './query-page.component.html',
  styleUrl: './query-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fade', [
      transition(':enter', useAnimation(dropdownIn)),
      transition(':leave', useAnimation(dropdownOut)),
    ]),
  ],
})
export class QueryPageComponent {
  private readonly allLangs = {
    sql: SQL(),
    xquery: XQuery(),
    cypher: Cypher({
      defaultGraph: 'defaultGraph',
    }),
  };
  private queryHistory = new History<string>(20);
  private dialogS = inject(MatDialog);

  optimizerOptions = new FormGroup({
    pushdown: new FormControl(true),
    duplicates: new FormControl(true),
  });
  form = new FormGroup({
    lang: new FormControl<'sql' | 'xquery' | 'cypher'>('sql'),
    query: new FormControl<string>('', Validators.required),
    dataSources: new FormGroup({
      defaultGraph: new FormControl(true),
    }),
    optimizer: new FormControl(false),
    optimizerOptions: this.optimizerOptions,
  });
  private lang = toSignal(this.form.get('lang').valueChanges, {
    initialValue: this.form.get('lang').value,
  });
  private db = computed(() => {
    const lang = this.lang();
    return new DortDB({
      mainLang: this.allLangs[lang],
      additionalLangs: Object.values(this.allLangs).filter(
        (l) => l !== this.allLangs[lang],
      ),
    });
  });
  plan: LogicalPlanOperator;
  output: QueryResult;
  error: Error;

  constructor() {
    lsSyncForm('query-page-form', this.form);
  }

  parse() {
    const query = this.form.get('query').value;
    this.error = null;
    this.plan = null;
    this.output = null;
    this.queryHistory.push(query);
    try {
      if (this.form.get('optimizer').value) {
        this.plan = optimizedPlan;
      } else {
        const ast = this.db().parse(query);
        console.log(ast);
        this.plan = this.db().buildPlan(ast.value[0]).plan;
        console.log(this.plan);
      }
    } catch (err) {
      this.error = err as Error;
      console.error(err);
    }
  }

  execute() {
    const query = this.form.get('query').value;
    this.error = null;
    this.plan = null;
    this.output = null;
    this.queryHistory.push(query);
    try {
      this.output = this.db().query(query);
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
