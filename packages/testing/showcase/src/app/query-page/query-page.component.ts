import {
  animate,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';
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
  datetime,
  DortDB,
  MapIndex,
  PlanOperator,
  QueryResult,
} from '@dortdb/core';
import { ConnectionIndex, Cypher } from '@dortdb/lang-cypher';
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
  IndexScans,
  JoinIndices,
  mergeFromToItems,
  MergeProjections,
  mergeToFromItems,
  productsToJoins,
  ProjConcatToJoin,
  PushdownSelections,
  UnnestSubqueries,
} from '@dortdb/core/optimizer';
import {
  OptimizerListComponent,
  OptimizerListItem,
} from './optimizer-list/optimizer-list.component';
import { UnibenchService } from '../services/unibench.service';
import { UnibenchData } from '@dortdb/dataloaders';
import { TPCHService } from '../services/tpch.service';
import { CodeInputComponent } from './code-input/code-input.component';

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
    CodeInputComponent,
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
    extensions: [datetime],
  });
  private queryHistory = new History<string>(20);
  private dialogS = inject(MatDialog);
  private unibenchS = inject(UnibenchService);
  private tpchS = inject(TPCHService);
  private allOptimizations = [
    UnnestSubqueries,
    mergeToFromItems,
    mergeFromToItems,
    PushdownSelections,
    ProjConcatToJoin,
    productsToJoins,
    JoinIndices,
    IndexScans,
    MergeProjections,
  ];
  private ruleList: OptimizerListItem[] = [
    { name: 'unnest subqueries', value: 0, enabled: true },
    { name: 'merge to-from items', value: 1, enabled: true },
    { name: 'merge from-to items', value: 2, enabled: true },
    {
      name: 'pushdown selections',
      value: 3,
      enabled: true,
    },
    {
      name: 'projection concat to join',
      value: 4,
      enabled: true,
    },
    { name: 'products to joins', value: 5, enabled: true },
    { name: 'join indices', value: 6, enabled: true },
    { name: 'index scans', value: 7, enabled: true },
    {
      name: 'merge projections',
      value: 8,
      enabled: true,
    },
  ];

  optimizerOptions = new FormGroup({
    enabled: new FormControl(true),
    optimizations: new FormControl(this.ruleList),
  });
  form = new FormGroup({
    lang: new FormControl<'sql' | 'xquery' | 'cypher'>('sql'),
    query: new FormControl<string>('', Validators.required),
    dataSources: new FormGroup({
      defaultGraph: new FormControl(true),
    }),
    optimizerSettings: new FormControl(false),
    optimizerOptions: this.optimizerOptions,
  });
  unibenchData: UnibenchData;
  plan: PlanOperator;
  output: QueryResult;
  error: Error;

  constructor() {
    lsSyncForm('query-page-form', this.form);
    if (
      this.optimizerOptions.value.optimizations.length <
      this.allOptimizations.length
    ) {
      this.optimizerOptions.get('optimizations').setValue(this.ruleList);
    }
    this.optimizerOptions.valueChanges
      .pipe(startWith(this.optimizerOptions.value), takeUntilDestroyed())
      .subscribe((options) => {
        if (options.enabled) {
          this.db.optimizer.reconfigure({
            rules: options.optimizations
              .filter((x) => x.enabled)
              .map((x) => this.allOptimizations[x.value]),
          });
        } else {
          this.db.optimizer.reconfigure({ rules: [] });
        }
      });

    this.registerDataSources();
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
      this.plan = this.db.buildPlan(ast.at(-1), {
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
      console.log(this.output);
      if (!this.output.schema) {
        this.output = {
          schema: ['value'],
          data: this.output.data.map((x) => ({ value: x })),
        };
      }
    } catch (err) {
      this.error = err as Error;
      console.error(err);
    }
  }

  async registerDataSources() {
    if (this.unibenchData) return;
    this.unibenchData = await this.unibenchS.getDataIfAvailable();
    if (!this.unibenchData) return;
    this.db.registerSource(['customers'], this.unibenchData.customers);
    this.db.registerSource(['products'], this.unibenchData.products);
    this.db.registerSource(['feedback'], this.unibenchData.feedback);
    this.db.registerSource(['orders'], this.unibenchData.orders);
    this.db.registerSource(['Invoices'], this.unibenchData.invoices);
    this.db.registerSource(['defaultGraph'], this.unibenchData.socialNetwork);
    (window as any)['defaultGraph'] = this.unibenchData.socialNetwork;
    this.db.registerSource(['brandProducts'], this.unibenchData.brandProducts);
    this.db.registerSource(['posts'], this.unibenchData.posts);
    this.db.registerSource(['vendors'], this.unibenchData.vendors);

    this.db.createIndex(['defaultGraph', 'nodes'], [], ConnectionIndex);
    this.db.createIndex(['defaultGraph', 'nodes'], ['x.id'], MapIndex, {
      fromItemKey: ['x'],
      mainLang: 'cypher',
    });
    this.db.createIndex(['defaultGraph', 'edges'], [], ConnectionIndex);
    this.db.createIndex(['customers'], ['id'], MapIndex);
    this.db.createIndex(['products'], ['productId'], MapIndex);
    this.db.createIndex(['products'], ['brand'], MapIndex);
    this.db.createIndex(['products'], ['asin'], MapIndex);
    this.db.createIndex(['feedback'], ['productAsin'], MapIndex);
    this.db.createIndex(['feedback'], ['personId'], MapIndex);
    this.db.createIndex(['brandProducts'], ['productAsin'], MapIndex);
    this.db.createIndex(['brandProducts'], ['brandName'], MapIndex);
    this.db.createIndex(['vendors'], ['id'], MapIndex);
    this.db.createIndex(['posts'], ['id'], MapIndex);
    this.db.createIndex(['orders'], ['PersonId::number'], MapIndex);
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
    ref.afterClosed().subscribe(() => this.registerDataSources());
  }

  private async registerTPCH() {
    const data = await this.tpchS.downloadData();

    this.db.registerSource(['customer'], data.customer);
    this.db.registerSource(['lineitem'], data.lineitem);
    this.db.registerSource(['nation'], data.nation);
    this.db.registerSource(['orders'], data.orders);
    this.db.registerSource(['part'], data.part);
    this.db.registerSource(['partsupp'], data.partsupp);
    this.db.registerSource(['region'], data.region);
    this.db.registerSource(['supplier'], data.supplier);

    this.db.createIndex(['customer'], ['custkey'], MapIndex);
    this.db.createIndex(['customer'], ['nationkey'], MapIndex);
    this.db.createIndex(['lineitem'], ['orderkey'], MapIndex);
    this.db.createIndex(['lineitem'], ['partkey'], MapIndex);
    this.db.createIndex(['lineitem'], ['suppkey'], MapIndex);
    this.db.createIndex(['nation'], ['nationkey'], MapIndex);
    this.db.createIndex(['nation'], ['regionkey'], MapIndex);
    this.db.createIndex(['orders'], ['custkey'], MapIndex);
    this.db.createIndex(['orders'], ['orderkey'], MapIndex);
    this.db.createIndex(['part'], ['partkey'], MapIndex);
    this.db.createIndex(['partsupp'], ['partkey'], MapIndex);
    this.db.createIndex(['partsupp'], ['suppkey'], MapIndex);
    this.db.createIndex(['region'], ['regionkey'], MapIndex);
    this.db.createIndex(['supplier'], ['suppkey'], MapIndex);
    this.db.createIndex(['supplier'], ['nationkey'], MapIndex);
  }
}
