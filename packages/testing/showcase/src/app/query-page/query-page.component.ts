import { transition, trigger, useAnimation } from '@angular/animations';
import { CommonModule } from '@angular/common';
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
import {
  csToJoin,
  DortDB,
  LogicalPlanOperator,
  mergeProjections,
  mergeSelections,
  mergeToFromItems,
  OptimizerComponent,
  pushdownSelections,
  QueryResult,
} from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
import { combineLatest } from 'rxjs';
import { dropdownIn, dropdownOut } from '../animations';
import { lsSyncForm } from '../utils/ls-sync-form';
import { DataSourcesDialogComponent } from './data-sources-dialog/data-sources-dialog.component';
import { DsTableComponent } from './ds-table/ds-table.component';
import { History } from './history';
import { HistoryDialogComponent } from './history-dialog/history-dialog.component';
import { optimizedPlan } from './optimized-plan';
import { optimizedPlanCrossmodel } from './optimized-plan-crossmodel';
import {
  Sample,
  SamplesDialogComponent,
} from './samples-dialog/samples-dialog.component';
import { TreeVisualizerComponent } from './tree-visualizer/tree-visualizer.component';

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
  private readonly db = new DortDB({
    mainLang: SQL(),
    additionalLangs: [XQuery(), Cypher({ defaultGraph: 'defaultGraph' })],
  });
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
  plan: LogicalPlanOperator;
  output: QueryResult;
  error: Error;

  constructor() {
    lsSyncForm('query-page-form', this.form);
    combineLatest([
      this.optimizerOptions.valueChanges,
      this.form.get('optimizer').valueChanges,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([options, enabled]) => {
        const components: OptimizerComponent[] = [];
        if (enabled) {
          if (options.pushdown) components.push(pushdownSelections);
          if (options.duplicates) {
            components.push(
              mergeToFromItems,
              mergeSelections,
              mergeProjections,
              csToJoin,
            );
          }
        }
        this.db.optimizer.reconfigure({
          components,
        });
      });
  }

  parse() {
    const formVal = this.form.value;
    this.error = null;
    this.plan = null;
    this.output = null;
    this.queryHistory.push(formVal.query);
    try {
      if (formVal.optimizer) {
        if (formVal.lang === 'xquery') {
          this.plan = optimizedPlanCrossmodel;
        } else {
          this.plan = optimizedPlan;
        }
      } else {
        const ast = this.db.parse(formVal.query, {
          mainLang: formVal.lang,
        });
        console.log(ast);
        this.plan = this.db.buildPlan(ast.value[0], {
          mainLang: formVal.lang,
        }).plan;
        console.log(this.plan);
      }
    } catch (err) {
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
