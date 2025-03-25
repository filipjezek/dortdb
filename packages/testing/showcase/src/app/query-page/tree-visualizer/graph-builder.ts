import {
  Aliased,
  allAttrs,
  ASTIdentifier,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from '@dortdb/lang-xquery';
import { strToColor } from '../../utils/str-to-color';

const langColors: Record<string, string> = {
  xquery: strToColor('xquery'),
  sql: strToColor('sql'),
  cypher: strToColor('cypherx'),
};

function sum(args: number[]) {
  return args.reduce((a, b) => a + b, 0);
}
const PADDING = 8;
const STROKE = 1;
const CHILD_OFFSET = 30;

interface Branch {
  el: SVGGElement;
  edgeType?: string;
  src?: SVGGraphicsElement;
}

export class GraphBuilder
  implements
    LogicalPlanVisitor<SVGGElement>,
    XQueryLogicalPlanVisitor<SVGGElement>
{
  private readonly drawingContainer: SVGGElement;
  private readonly textContainer = document.createElement('p');
  public readonly cssVariables: ReadonlySet<string>;
  public get width() {
    return this._width;
  }
  public get height() {
    return this._height;
  }
  private _width = 0;
  private _height = 0;

  constructor(
    private readonly container: SVGSVGElement,
    private vmap: Record<string, LogicalPlanVisitor<SVGGElement>>,
  ) {
    this.container.innerHTML = `
      <style>
        svg {
          &.shadows {
            rect {
              filter: drop-shadow(0 0 5px var(--lang-color));
              stroke: var(--lang-color);
            }
          }
          &.triangles {
            polygon {
              fill: var(--lang-color);
            }
          }
        }
        svg * {
          stroke-width: ${STROKE * 2}px;
          paint-order: stroke;
          font-family: Georgia, Times, 'Times New Roman', serif;
          font-size: 15px;
        }
        foreignObject div {
          max-width: 140px;
          word-wrap: break-word;
          width: fit-content;
          text-align: center;
          color: var(--mat-sys-on-surface);

          &.source-tuple {
            font-weight: bold;
          }
          &.source-item {
            font-weight: bold;
            font-style: italic;
          }
          .placeholder {
            color: #546be8;
            font-weight: bold;
          }
          &.groupby .placeholder {
            color: #a65d1e;
          }
          .schema {
            font-size: 12px;
            color: var(--mat-sys-outline);
            font-weight: normal;
            margin: 0 auto 4px;

            span[title] {
              font-size: inherit;
            }
          }
        }
        rect {
          fill: var(--mat-sys-surface);
          stroke: var(--mat-sys-outline);

          &:has(~ foreignObject > .groupby) {
            stroke: var(--mat-sys-surface) !important;
            filter: none !important;
          }
        }
        polygon {
          fill: transparent;

          &:has(~ foreignObject > .groupby) {
            fill: transparent !important;
          }
        }
        line {
          stroke: #888888;
          stroke-width: 2px;

          &.djoin {
            stroke-dasharray: 3;
          }
          &.group-op {
            stroke: #a65d1e;
          }
        }
      </style>
      <g id="drawing-container"></g>
    `;
    this.cssVariables = new Set(
      Array.from(this.container.innerHTML.matchAll(/var\((--[^),]+)\)/g)).map(
        (m) => m[1],
      ),
    );
    this.drawingContainer = this.container.querySelector('#drawing-container');
  }

  private getSchemaTemplate(operator: LogicalPlanOperator) {
    return (
      operator instanceof LogicalPlanTupleOperator &&
      operator.schema &&
      `<div class="schema">[${operator.schema
        .map((id) => this.stringifyId(id))
        .join(', ')}]</div>`
    );
  }

  private markup<T extends Element>(template: string): T {
    this.drawingContainer.innerHTML = template;
    return this.drawingContainer.firstElementChild as T;
  }

  private drawNode(
    text: string,
    operator: LogicalPlanOperator,
    textClass = '',
  ): SVGGElement {
    const schemaTemplate = this.getSchemaTemplate(operator);

    const foEl = this
      .markup(`<foreignObject height="2000" width="200" xmlns="http://www.w3.org/1999/xhtml">
      <div class="${textClass}">
        ${schemaTemplate || ''}
        ${text}
      </div>
    </foreignObject>`);
    const textEl = foEl.firstElementChild as HTMLElement;
    const textBBox = textEl.getBoundingClientRect();
    foEl.setAttribute('width', textBBox.width + '');
    foEl.setAttribute('height', textBBox.height + '');
    foEl.setAttribute(
      'y',
      (textBBox.height - textBBox.height) / 2 + PADDING + '',
    );
    foEl.setAttribute(
      'x',
      (textBBox.width - textBBox.width) / 2 + PADDING + '',
    );

    const result = this.markup<SVGGElement>(`
    <g style="--lang-color: ${langColors[operator.lang]}">
      <rect width="${textBBox.width + PADDING * 2}" height="${
        textBBox.height + PADDING * 2
      }" />
      <polygon points="0,0 0,10 10,0" />
    </g>
    `);
    result.appendChild(foEl);
    return result;
  }

  private getG(): SVGGElement {
    return this.markup('<g></g>');
  }
  private escapeHtml(text: string) {
    this.textContainer.textContent = text;
    return this.textContainer.innerHTML;
  }
  private escapeAttr(text: string) {
    return text.replace(/"/g, '&quot;');
  }
  private stringifyId(id: ASTIdentifier) {
    const full = id.parts
      .map((x) =>
        typeof x === 'string'
          ? this.escapeHtml(x)
          : x === allAttrs
            ? '*'
            : x?.toString(),
      )
      .join('.');
    if (full.length < 19) {
      return full;
    }
    return `<span title="${this.escapeAttr(full)}">${full.slice(
      0,
      16,
    )}&hellip;</span>`;
  }

  private processAttr(
    [attr, alias]: Aliased<ASTIdentifier | plan.Calculation>,
    counter: { i: number },
  ): string {
    const aliasStr = this.stringifyId(alias);
    if (attr instanceof ASTIdentifier) {
      const attrStr = this.stringifyId(attr);
      return attrStr === aliasStr ? attrStr : `${aliasStr}=${attrStr}`;
    }
    return `<span class="placeholder placeholder-${counter.i++}">${aliasStr}</span>`;
  }

  public drawTree(plan: LogicalPlanOperator): void {
    this.container
      .querySelectorAll('#drawing-container ~ *')
      .forEach((el) => el.remove());
    this.container.removeAttribute('viewBox');
    const root = plan.accept(this.vmap);
    this.drawingContainer.innerHTML = '';
    root.setAttribute(
      'transform',
      `translate(${STROKE + PADDING}, ${STROKE + PADDING})`,
    );
    this.container.appendChild(root);
    const bbox = root.getBBox();
    this._width = bbox.width + STROKE * 2 + PADDING * 2;
    this._height = bbox.height + STROKE * 2 + PADDING * 2;
    this.container.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.container.setAttribute('width', this.width + '');
  }

  private drawBranches(parent: SVGGraphicsElement, ...branches: Branch[]) {
    const g = this.getG();
    g.append(parent, ...branches.map((b) => b.el));
    const parentBBox = parent.getBoundingClientRect();
    const bboxes = branches.map((b) => b.el.getBBox());
    const childrenWidth =
      sum(bboxes.map((b) => b.width + PADDING * 2)) - 2 * PADDING;
    const totalWidth = Math.max(childrenWidth, parentBBox.width);

    parent.setAttribute(
      'transform',
      `translate(${(totalWidth - parentBBox.width) / 2 + ''}, 0)`,
    );
    const srcBBoxes = branches.map((b) => b.src?.getBoundingClientRect());
    let x = (totalWidth - childrenWidth) / 2;
    for (let i = 0; i < branches.length; i++) {
      branches[i].el.setAttribute(
        'transform',
        `translate(${x}, ${parentBBox.height + CHILD_OFFSET})`,
      );

      const edge = this.drawEdge(
        srcBBoxes[i],
        branches[i].edgeType,
        bboxes[i],
        parentBBox,
        totalWidth,
        x,
      );
      if (branches[i].src) {
        parent.insertAdjacentElement('afterend', edge);
      } else {
        g.prepend(edge);
      }
      x += bboxes[i].width + PADDING * 2;
    }
    return g;
  }

  private drawEdge(
    srcBBox: DOMRect,
    edgeType: string,
    bbox: DOMRect,
    parent: DOMRect,
    totalWidth: number,
    x: number,
  ) {
    const edge = this.markup(
      srcBBox
        ? `<line
        x1="${srcBBox.x - parent.x + srcBBox.width / 2}"
        y1="${srcBBox.y - parent.y + srcBBox.height}"
        x2="${x + bbox.width / 2}"
        y2="${parent.height + CHILD_OFFSET}"
      ></line>`
        : `<line
        x1="${totalWidth / 2}"
        y1="${parent.height / 2}"
        x2="${x + bbox.width / 2}"
        y2="${parent.height + CHILD_OFFSET}"
      ></line>`,
    );
    if (edgeType) {
      edge.classList.add(edgeType);
    }
    return edge;
  }

  visitProjection(operator: plan.Projection): SVGGElement {
    const src = operator.source.accept(this.vmap);
    const calcI = { i: 0 };
    const attrs = operator.attrs.map((a) => this.processAttr(a, calcI));
    const parent = this.drawNode(
      `&pi;(${attrs.map((a) => a).join(', ')})`,
      operator,
    );
    const calcs = operator.attrs
      .filter((a) => a[0] instanceof plan.Calculation)
      .map(([a]) => this.visitCalculation(a as plan.Calculation))
      .map((el, i) => ({
        el,
        edgeType: 'djoin',
        src: parent.querySelector<SVGGraphicsElement>('.placeholder-' + i),
      }));
    return this.drawBranches(parent, { el: src }, ...calcs);
  }

  private processArg(
    arg: ASTIdentifier | LogicalPlanOperator,
    counter: { i: number },
  ) {
    return arg instanceof ASTIdentifier
      ? this.stringifyId(arg)
      : `<span class="placeholder placeholder-${counter.i++}">_</span>`;
  }

  visitSelection(operator: plan.Selection): SVGGElement {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode(`&sigma;(${arg})`, operator);
    return operator.condition instanceof ASTIdentifier
      ? this.drawBranches(parent, { el: src })
      : this.drawBranches(
          parent,
          { el: src },
          {
            el: operator.condition.accept(this.vmap),
            edgeType: 'djoin',
            src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
          },
        );
  }
  visitTupleSource(operator: plan.TupleSource): SVGGElement {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    return this.drawNode(name, operator, 'source-tuple');
  }
  visitItemSource(operator: plan.ItemSource): SVGGElement {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    return this.drawNode(name, operator, 'source-item');
  }
  visitFnCall(operator: plan.FnCall): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: plan.Calculation): SVGGElement {
    const opI = { i: 0 };
    const args = operator.args.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`calc(${args.join(', ')})`, operator);
    const ops = operator.args
      .filter((a) => !(a instanceof ASTIdentifier))
      .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
      .map((el, i) => ({
        el,
        src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
      }));
    return this.drawBranches(parent, ...ops);
  }
  visitConditional(operator: plan.Conditional): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: plan.CartesianProduct): SVGGElement {
    const parent = this.drawNode('&times;', operator);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) },
    );
  }
  visitJoin(operator: plan.Join): SVGGElement {
    const condition = this.processArg(operator.on, { i: 0 });
    const parent = this.drawNode(
      `${operator.leftOuter ? '&deg;' : ''}&bowtie;${
        operator.rightOuter ? '&deg;' : ''
      }(${condition})`,
      operator,
    );
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      {
        el: operator.on.accept(this.vmap),
        edgeType: 'djoin',
        src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
      },
      { el: operator.right.accept(this.vmap) },
    );
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): SVGGElement {
    const parent = this.drawNode(
      (operator.outer ? '&deg;' : '') + '&bowtie;&#x0362;',
      operator,
    );
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      { el: operator.mapping.accept(this.vmap), edgeType: 'djoin' },
    );
  }
  visitMapToItem(operator: plan.MapToItem): SVGGElement {
    const parent = this.drawNode(
      `toItem(${this.stringifyId(operator.key)})`,
      operator,
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitMapFromItem(operator: plan.MapFromItem): SVGGElement {
    const parent = this.drawNode(
      `fromItem(${this.stringifyId(operator.key)})`,
      operator,
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): SVGGElement {
    const parent = this.drawNode(
      `index(${this.stringifyId(operator.indexCol)})`,
      operator,
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitOrderBy(operator: plan.OrderBy): SVGGElement {
    const opI = { i: 0 };
    const args = operator.orders.map(
      (o) => this.processArg(o.key, opI) + (o.ascending ? '' : '&darr;'),
    );
    const parent = this.drawNode(`&tau;(${args.join(', ')})`, operator);
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      ...operator.orders
        .filter((o) => o.key instanceof plan.Calculation)
        .map((o) => (o.key as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          edgeType: 'djoin',
        })),
    );
  }
  visitGroupBy(operator: plan.GroupBy): SVGGElement {
    const opI = { i: 0 };
    const keys = operator.keys.map((k) => this.processAttr(k, opI));
    const kChildren = opI.i;
    const aggs = operator.aggs.map(
      (a) =>
        `<span class="placeholder placeholder-${opI.i++}">${this.stringifyId(
          a.fieldName,
        )}</span>`,
    );
    let parent = this.drawNode(
      `&gamma;([${keys.join(', ')}]; [${aggs.join(', ')}])`,
      operator,
      'groupby',
    );
    parent = this.drawBranches(
      parent,
      ...operator.keys
        .filter((k) => k instanceof plan.Calculation)
        .map((k) => (k as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          edgeType: 'djoin',
        })),
      ...operator.aggs.map((a, i) => ({
        el: a.postGroupOp.accept(this.vmap),
        edgeType: 'group-op',
        src: parent.querySelector<SVGGraphicsElement>(
          `.placeholder-${i + kChildren}`,
        ),
      })),
    );
    parent.setAttribute('transform', `translate(${PADDING}, ${PADDING})`);
    this.drawingContainer.appendChild(parent);
    const bbox = parent.getBBox();
    const groupbyWrapper = this
      .markup<SVGGElement>(`<g style="--lang-color: ${langColors[operator.lang]}"><rect
      x="0"
      y="0"
      width="${bbox.width + PADDING * 2}"
      height="${bbox.height + PADDING * 2}"
    ></rect><polygon points="0,0 0,10 10,0" /></g>`);
    groupbyWrapper.appendChild(parent);

    return this.drawBranches(groupbyWrapper, {
      el: operator.source.accept(this.vmap),
    });
  }
  visitLimit(operator: plan.Limit): SVGGElement {
    const parent = this.drawNode(
      `limit(${operator.limit}, ${operator.skip})`,
      operator,
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitUnion(operator: plan.Union): SVGGElement {
    const parent = this.drawNode('&cup;', operator);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) },
    );
  }
  visitIntersection(operator: plan.Intersection): SVGGElement {
    const parent = this.drawNode('&cap;', operator);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) },
    );
  }
  visitDifference(operator: plan.Difference): SVGGElement {
    const parent = this.drawNode('&setminus;', operator);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) },
    );
  }
  visitDistinct(operator: plan.Distinct): SVGGElement {
    if (operator.attrs === allAttrs) {
      const parent = this.drawNode('&delta;(*)', operator);
      return this.drawBranches(parent, {
        el: operator.source.accept(this.vmap),
      });
    }
    const opI = { i: 0 };
    const args = operator.attrs.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`&delta;(${args.join(', ')})`, operator);
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      ...operator.attrs
        .filter((a) => a instanceof plan.Calculation)
        .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          edgeType: 'djoin',
        })),
    );
  }
  visitNullSource(operator: plan.NullSource): SVGGElement {
    return this.drawNode(
      '&square;',
      { lang: operator.lang } as LogicalPlanOperator, // do not draw schema
      'source-tuple',
    );
  }
  visitAggregate(operator: plan.AggregateCall): SVGGElement {
    throw new Error('Method not implemented.');
  }

  private visitFnSource(
    operator: plan.ItemFnSource | plan.TupleFnSource,
  ): SVGGElement {
    const opI = { i: 0 };
    const args = operator.args.map((a) => this.processArg(a, opI));
    const name = operator.name
      ? operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 })
      : 'function';
    const parent = this.drawNode(
      `${name}(${args.join(', ')})`,
      operator,
      'source-' + (operator instanceof plan.ItemFnSource ? 'item' : 'tuple'),
    );
    return this.drawBranches(
      parent,
      ...operator.args
        .filter((a) => a instanceof plan.Calculation)
        .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
        })),
    );
  }
  visitItemFnSource(operator: plan.ItemFnSource): SVGGElement {
    return this.visitFnSource(operator);
  }
  visitTupleFnSource(operator: plan.TupleFnSource): SVGGElement {
    return this.visitFnSource(operator);
  }
  visitQuantifier(operator: plan.Quantifier): SVGGElement {
    throw new Error('Method not implemented.');
  }

  visitTreeJoin(operator: TreeJoin): SVGGElement {
    const parent = this.drawNode('TreeJoin', operator);
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      { el: operator.step.accept(this.vmap), edgeType: 'djoin' },
    );
  }

  visitProjectionSize(operator: ProjectionSize): SVGGElement {
    const parent = this.drawNode(
      `size(${this.stringifyId(operator.sizeCol)})`,
      operator,
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }

  visitRecursion(operator: plan.Recursion): SVGGElement {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode(
      `&phi;(${operator.min}, ${operator.max}, ${arg})`,
      operator,
    );
    return this.drawBranches(
      parent,
      { el: src },
      {
        el: operator.condition.accept(this.vmap),
        edgeType: 'djoin',
        src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
      },
    );
  }
}
