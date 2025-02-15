import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogicalPlanOperator, LogicalPlanVisitor } from '@dortdb/core';
import { GraphBuilder } from './graph-builder';
import { MatCheckbox } from '@angular/material/checkbox';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { lsSyncForm } from '../../utils/ls-sync-form';

@Component({
  selector: 'dort-tree-visualizer',
  imports: [CommonModule, MatCheckbox, ReactiveFormsModule],
  templateUrl: './tree-visualizer.component.html',
  styleUrl: './tree-visualizer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeVisualizerComponent implements AfterViewInit {
  private svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private static instances = 0;
  readonly id = TreeVisualizerComponent.instances++;
  private graphBuilder: GraphBuilder;
  form = new FormGroup({
    shadows: new FormControl(false),
    triangles: new FormControl(true),
  });

  plan = input<LogicalPlanOperator>();

  constructor() {
    lsSyncForm(`tree-visualizer-${this.id}-form`, this.form);
    effect(() => {
      const p = this.plan();
      if (p && this.graphBuilder) {
        this.graphBuilder.drawTree(p);
      }
    });
  }

  ngAfterViewInit(): void {
    const vmap: Record<string, LogicalPlanVisitor<SVGGElement>> = {};
    this.graphBuilder = new GraphBuilder(this.svg().nativeElement, vmap);
    vmap['xquery'] = vmap['sql'] = vmap['cypher'] = this.graphBuilder;
  }
}
