import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DortDB, LogicalPlanOperator } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
import { Cypher } from '@dortdb/lang-cypher';
import { TreeVisualizerComponent } from './tree-visualizer/tree-visualizer.component';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { History } from './history';
import { MatDialog } from '@angular/material/dialog';
import { HistoryDialogComponent } from './history-dialog/history-dialog.component';
import { lsSyncForm } from '../utils/ls-sync-form';
import { MatCardModule } from '@angular/material/card';
import {
  Sample,
  SamplesDialogComponent,
} from './samples-dialog/samples-dialog.component';
import { DataSourcesDialogComponent } from './data-sources-dialog/data-sources-dialog.component';

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
  ],
  templateUrl: './query-page.component.html',
  styleUrl: './query-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  form = new FormGroup({
    lang: new FormControl<'sql' | 'xquery' | 'cypher'>('sql'),
    query: new FormControl<string>('', Validators.required),
    dataSources: new FormGroup({
      defaultGraph: new FormControl(true),
    }),
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
  error: Error;

  constructor() {
    lsSyncForm('query-page-form', this.form);
  }

  parse() {
    const query = this.form.get('query').value;
    this.error = null;
    this.queryHistory.push(query);
    try {
      const ast = this.db().parse(query);
      console.log(ast);
      this.plan = this.db().buildPlan(ast.value[0]).plan;
      console.log(this.plan);
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
