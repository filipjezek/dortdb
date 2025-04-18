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
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import * as d3 from 'd3';

@Component({
  selector: 'dort-tree-visualizer',
  imports: [
    CommonModule,
    MatCheckbox,
    ReactiveFormsModule,
    MatButtonModule,
    MatIcon,
  ],
  templateUrl: './tree-visualizer.component.html',
  styleUrl: './tree-visualizer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeVisualizerComponent implements AfterViewInit {
  private svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private static instances = 0;
  readonly id = TreeVisualizerComponent.instances++;
  private graphBuilder: GraphBuilder;
  private zoom: d3.ZoomBehavior<Element, unknown>;
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
        this.resetZoom();
        this.graphBuilder.drawTree(p);
      }
    });
  }

  private resetZoom() {
    this.zoom.transform(
      d3.select(this.svg().nativeElement.parentElement as Element),
      d3.zoomIdentity,
    );
  }

  ngAfterViewInit(): void {
    const vmap: Record<string, LogicalPlanVisitor<SVGGElement>> = {};
    this.graphBuilder = new GraphBuilder(this.svg().nativeElement, vmap);
    vmap['xquery'] = vmap['sql'] = vmap['cypher'] = this.graphBuilder;
    if (this.plan()) {
      this.graphBuilder.drawTree(this.plan());
    }
    this.zoom = this.initZoom();
  }

  saveImage(svgNode: SVGSVGElement) {
    const compStyle = getComputedStyle(svgNode);
    for (const prop of this.graphBuilder.cssVariables) {
      svgNode.style.setProperty(prop, compStyle.getPropertyValue(prop));
    }
    const svgString = new XMLSerializer().serializeToString(svgNode);
    for (const prop of this.graphBuilder.cssVariables) {
      svgNode.style.removeProperty(prop);
    }
    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });

    const url = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.width = svgNode.width.baseVal.value;
    image.height = svgNode.height.baseVal.value;
    image.src = url;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);

      const imgURI = canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
      this.triggerDownload(imgURI);
    };
  }

  private triggerDownload(imgURI: string) {
    const a = document.createElement('a');
    a.download = 'tree.png';
    a.target = '_blank';
    a.href = imgURI;

    a.dispatchEvent(
      new MouseEvent('click', {
        bubbles: false,
        cancelable: true,
      }),
    );
  }

  private initZoom() {
    const zoom = d3
      .zoom()
      .scaleExtent([1, Infinity])
      .on('zoom', (e: d3.D3ZoomEvent<Element, unknown>) => {
        this.svg().nativeElement.setAttribute(
          'transform',
          e.transform.toString(),
        );
      });
    const zoomContainer = d3.select(
      this.svg().nativeElement.parentElement as Element,
    );
    zoomContainer.call(zoom);
    return zoom;
  }
}
