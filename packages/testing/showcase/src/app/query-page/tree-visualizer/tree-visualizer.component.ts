import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanOperator, PlanVisitor } from '@dortdb/core';
import { GraphBuilder, NodeData } from './graph-builder';
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
  private zoomContainer = computed(() =>
    d3.select(this.svg().nativeElement.parentElement.parentElement as Element),
  );
  private svgContainer = computed(() =>
    d3.select(this.svg().nativeElement.parentElement as Element),
  );
  private static instances = 0;
  readonly id = TreeVisualizerComponent.instances++;
  private graphBuilder: GraphBuilder;
  private zoom: d3.ZoomBehavior<Element, unknown>;
  form = new FormGroup({
    shadows: new FormControl(false),
    triangles: new FormControl(true),
  });

  plan = input<PlanOperator>();

  constructor() {
    lsSyncForm(`tree-visualizer-form`, this.form);
    effect(() => {
      const p = this.plan();
      if (p && this.graphBuilder) {
        this.resetZoom();
        this.graphBuilder.drawTree(p);
      }
    });
  }

  private resetZoom() {
    this.zoom.transform(this.zoomContainer(), d3.zoomIdentity);
  }

  ngAfterViewInit(): void {
    const vmap: Record<string, PlanVisitor<NodeData>> = {};
    this.graphBuilder = new GraphBuilder(this.svg().nativeElement, vmap);
    vmap['xquery'] = vmap['sql'] = vmap['cypher'] = this.graphBuilder;
    if (this.plan()) {
      this.graphBuilder.drawTree(this.plan());
    }
    this.zoom = this.initZoom();
  }

  private inlineShadows(svgNode: SVGSVGElement) {
    if (!svgNode.classList.contains('shadows')) return;
    svgNode.querySelectorAll('rect').forEach((rect) => {
      const compStyle = getComputedStyle(rect);
      rect.style.filter = `url(#shadow-${rect.parentElement.dataset['lang']})`;
      rect.style.stroke = compStyle.stroke;
    });
  }

  private removeInlineShadows(svgNode: SVGSVGElement) {
    if (!svgNode.classList.contains('shadows')) return;
    svgNode.querySelectorAll('rect').forEach((rect) => {
      rect.style.stroke = null;
      rect.style.filter = null;
    });
  }

  private removeLightDark(color: string, isDark: boolean): string {
    const regex = /light-dark\(([^,]+),([^)]+)\)/;
    const match = color.match(regex);
    if (match) {
      return isDark ? match[2] : match[1];
    }
    return color;
  }

  saveImage(svgNode: SVGSVGElement) {
    const compStyle = getComputedStyle(svgNode);
    this.inlineShadows(svgNode);

    let svgString = new XMLSerializer().serializeToString(svgNode);
    const isDark = document.body.classList.contains('dark');
    svgString = svgString.replaceAll(/var\(--[^)]+\)/g, (match) => {
      const value = compStyle.getPropertyValue(match.slice(4, -1).trim());
      if (!value) return match;
      return this.removeLightDark(value, isDark);
    });
    svgString = svgString.replace(/svg\.shadows rect {.+?}/s, '');

    this.removeInlineShadows(svgNode);
    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });

    const url = URL.createObjectURL(svgBlob);
    this.triggerDownload(url);
  }

  private triggerDownload(imgURI: string) {
    const a = document.createElement('a');
    a.download = 'tree.svg';
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
        this.svgContainer().style(
          'transform',
          `translate(${e.transform.x}px, ${e.transform.y}px) scale(${e.transform.k})`,
        );
      });
    this.zoomContainer().call(zoom);
    return zoom;
  }
}
