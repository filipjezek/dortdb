import {
  Aliased,
  allAttrs,
  ASTIdentifier,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '@dortdb/core';
import { retI1 } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';
import {
  ProjectionSize,
  TreeJoin,
  XQueryPlanVisitor,
} from '@dortdb/lang-xquery';
import { strToColor } from '../../utils/str-to-color';
import { flextree, FlextreeNode } from 'd3-flextree';

const langColors: Record<string, string> = {
  xquery: strToColor('xquery'),
  sql: strToColor('sql'),
  cypher: strToColor('cypherx'),
};

function sum(args: number[]) {
  return args.reduce((a, b) => a + b, 0);
}

interface Branch {
  el: SVGGElement;
  edgeType?: string;
  src?: SVGGraphicsElement;
}

export interface NodeData {
  el: SVGGraphicsElement;
  bbox: { width: number; height: number };
  connection?: {
    edgeType?: string;
    src?: SVGGraphicsElement;
  };
  children: NodeData[];
}

export class GraphBuilder
  implements PlanVisitor<NodeData>, XQueryPlanVisitor<NodeData>
{
  public static readonly STROKE = 1;
  public static readonly PADDING = 8;
  public static readonly CHILD_OFFSET = 30;

  protected readonly drawingContainer: SVGGElement;
  protected readonly treeContainer: SVGGElement;
  protected readonly textContainer = document.createElement('p');
  public readonly cssVariables: ReadonlySet<string>;
  public get width() {
    return this._width;
  }
  public get height() {
    return this._height;
  }
  protected _width = 0;
  protected _height = 0;

  protected layout = flextree<NodeData>({
    children: (d) => d.children,
    nodeSize: (node) => {
      return [
        node.data.bbox.width,
        node.data.bbox.height + GraphBuilder.CHILD_OFFSET,
      ];
    },
    spacing: (nodeA, nodeB) => nodeA.path(nodeB).length * 5,
  });

  constructor(
    protected readonly container: SVGSVGElement,
    protected vmap: Record<string, PlanVisitor<NodeData>>,
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
          stroke-width: ${GraphBuilder.STROKE * 2}px;
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
        foreignObject > div {
          padding: 1px 0;
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
      <g id="tree-container"></g>
    `;
    this.cssVariables = new Set(
      Array.from(
        this.container.innerHTML.matchAll(/var\((--[^),]+)\)/g),
        retI1 as any,
      ),
    );
    this.drawingContainer = this.container.querySelector('#drawing-container');
    this.treeContainer = this.container.querySelector('#tree-container');
  }

  protected getSchemaTemplate(operator: PlanOperator) {
    return (
      operator instanceof PlanTupleOperator &&
      operator.schema &&
      `<div class="schema">[${operator.schema
        .map((id) => this.stringifyId(id))
        .join(', ')}]</div>`
    );
  }

  protected markup<T extends Element>(template: string): T {
    this.drawingContainer.innerHTML = template;
    return this.drawingContainer.firstElementChild as T;
  }

  protected drawNode(
    text: string,
    operator: PlanOperator,
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
      (textBBox.height - textBBox.height) / 2 + GraphBuilder.PADDING + '',
    );
    foEl.setAttribute(
      'x',
      (textBBox.width - textBBox.width) / 2 + GraphBuilder.PADDING + '',
    );

    const result = this.markup<SVGGElement>(`
    <g style="--lang-color: ${langColors[operator.lang]}">
      <rect width="${textBBox.width + GraphBuilder.PADDING * 2}" height="${
        textBBox.height + GraphBuilder.PADDING * 2
      }" />
      <polygon points="0,0 0,10 10,0" />
    </g>
    `);
    result.appendChild(foEl);
    return result;
  }

  protected getG(): SVGGElement {
    return this.markup('<g></g>');
  }
  protected escapeHtml(text: string) {
    this.textContainer.textContent = text;
    return this.textContainer.innerHTML;
  }
  protected escapeAttr(text: string) {
    return text.replace(/"/g, '&quot;');
  }
  protected stringifyId(id: ASTIdentifier) {
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

  protected processAttr(
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

  public drawTree(plan: PlanOperator): void {
    this.treeContainer.innerHTML = '';
    this.container.removeAttribute('viewBox');
    const root = plan.accept(this.vmap);
    const tree = this.layout.hierarchy(root);
    this.layout(tree);
    this.drawingContainer.innerHTML = '';
    this.treeContainer.innerHTML = '';
    const drawnTree = this.drawSubTree(this.treeContainer, tree);

    const bbox = drawnTree.getBBox();
    drawnTree.setAttribute(
      'transform',
      `translate(${GraphBuilder.STROKE + GraphBuilder.PADDING - bbox.x}, ${GraphBuilder.STROKE + GraphBuilder.PADDING})`,
    );

    this._width =
      bbox.width + GraphBuilder.STROKE * 2 + GraphBuilder.PADDING * 2;
    this._height =
      bbox.height + GraphBuilder.STROKE * 2 + GraphBuilder.PADDING * 2;
    this.container.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.container.setAttribute('width', this.width + '');
    this.container.style.aspectRatio = `${this.width} / ${this.height}`;
  }

  protected drawSubTree(
    container: SVGGElement,
    subtree: FlextreeNode<NodeData>,
  ): SVGGraphicsElement {
    for (const child of subtree.children ?? []) {
      if (child.data.connection?.src) continue;
      container.appendChild(
        this.drawEdge(child.data.connection?.edgeType ?? '', child, subtree),
      );
    }
    const subX = subtree.x - subtree.xSize / 2;
    container.appendChild(subtree.data.el);
    subtree.data.el.setAttribute(
      'transform',
      `translate(${subX}, ${subtree.y})`,
    );
    for (const child of subtree.children ?? []) {
      if (child.data.connection?.src) {
        container.appendChild(
          this.drawEdge(
            child.data.connection?.edgeType ?? '',
            child,
            subtree,
            child.data.connection.src.getBoundingClientRect(),
          ),
        );
      }
      this.drawSubTree(container, child);
    }
    return container;
  }

  protected drawEdge(
    edgeType: string,
    child: FlextreeNode<NodeData>,
    parent: FlextreeNode<NodeData>,
    srcBBox?: DOMRect,
  ) {
    const parentBBox = parent.data.el.getBoundingClientRect();
    const edge = this.markup(
      srcBBox
        ? `<line
        x1="${srcBBox.x - parentBBox.x + (parent.x - parent.xSize / 2) + srcBBox.width / 2}"
        y1="${srcBBox.y - parentBBox.y + srcBBox.height + parent.y}"
        x2="${child.x}"
        y2="${child.y}"
      ></line>`
        : `<line
        x1="${parent.x}"
        y1="${parent.y + parent.ySize / 2}"
        x2="${child.x}"
        y2="${child.y}"
      ></line>`,
    );
    if (edgeType) {
      edge.classList.add(edgeType);
    }
    return edge;
  }

  visitProjection(operator: plan.Projection): NodeData {
    const src = operator.source.accept(this.vmap);
    const calcI = { i: 0 };
    const attrs = operator.attrs.map((a) => this.processAttr(a, calcI));
    const parent = this.drawNode(
      `&pi;(${attrs.map((a) => a).join(', ')})`,
      operator,
    );
    const bbox = parent.getBBox();
    const calcs = operator.attrs
      .filter((a) => a[0] instanceof plan.Calculation)
      .map(([a]) => this.visitCalculation(a as plan.Calculation))
      .map((el, i) => ({
        ...el,
        connection: {
          edgeType: 'djoin',
          src: parent.querySelector<SVGGraphicsElement>('.placeholder-' + i),
        },
      }));
    return {
      el: parent,
      bbox,
      children: [src, ...calcs],
    };
  }

  protected processArg(
    arg: ASTIdentifier | PlanOperator,
    counter: { i: number },
  ) {
    return arg instanceof ASTIdentifier
      ? this.stringifyId(arg)
      : `<span class="placeholder placeholder-${counter.i++}">_</span>`;
  }

  visitSelection(operator: plan.Selection): NodeData {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode(`&sigma;(${arg})`, operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        src,
        {
          ...operator.condition.accept(this.vmap),
          connection: {
            edgeType: 'djoin',
            src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
          },
        },
      ],
    };
  }
  visitTupleSource(operator: plan.TupleSource): NodeData {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    const parent = this.drawNode(name, operator, 'source-tuple');
    return { el: parent, bbox: parent.getBBox(), children: [] };
  }
  visitItemSource(operator: plan.ItemSource): NodeData {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    const parent = this.drawNode(name, operator, 'source-item');
    return { el: parent, bbox: parent.getBBox(), children: [] };
  }
  visitFnCall(operator: plan.FnCall): NodeData {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal): NodeData {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: plan.Calculation): NodeData {
    const opI = { i: 0 };
    const args = operator.args.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`calc(${args.join(', ')})`, operator);
    const bbox = parent.getBBox();
    const ops = operator.args
      .filter((a) => !(a instanceof ASTIdentifier))
      .map((a) => (a as PlanOperator).accept(this.vmap))
      .map((el, i) => ({
        ...el,
        connection: {
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
        },
      }));
    return {
      el: parent,
      bbox,
      children: ops,
    };
  }
  visitConditional(operator: plan.Conditional): NodeData {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: plan.CartesianProduct): NodeData {
    const parent = this.drawNode('&times;', operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.left.accept(this.vmap),
        operator.right.accept(this.vmap),
      ],
    };
  }
  visitJoin(operator: plan.Join): NodeData {
    const opI = { i: 0 };
    const conditions = operator.conditions.map((c) => this.processArg(c, opI));
    const parent = this.drawNode(
      `${operator.leftOuter ? '&deg;' : ''}&bowtie;${
        operator.rightOuter ? '&deg;' : ''
      }(${conditions.join(', ')})`,
      operator,
    );
    const bbox = parent.getBBox();
    return {
      el: parent,
      bbox,
      children: [
        operator.left.accept(this.vmap),
        ...operator.conditions
          .map((a) => a.accept(this.vmap))
          .map((el, i) => ({
            ...el,
            connection: {
              edgeType: 'djoin',
              src: parent.querySelector<SVGGraphicsElement>(
                `.placeholder-${i}`,
              ),
            },
          })),
        operator.right.accept(this.vmap),
      ],
    };
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): NodeData {
    const parent = this.drawNode(
      (operator.outer ? '&deg;' : '') + '&bowtie;&#x0362;',
      operator,
    );
    const bbox = parent.getBBox();
    return {
      el: parent,
      bbox,
      children: [
        operator.source.accept(this.vmap),
        {
          ...operator.mapping.accept(this.vmap),
          connection: {
            edgeType: 'djoin',
          },
        },
      ],
    };
  }
  visitMapToItem(operator: plan.MapToItem): NodeData {
    const parent = this.drawNode(
      `toItem(${this.stringifyId(operator.key)})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitMapFromItem(operator: plan.MapFromItem): NodeData {
    const parent = this.drawNode(
      `fromItem(${this.stringifyId(operator.key)})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): NodeData {
    const parent = this.drawNode(
      `index(${this.stringifyId(operator.indexCol)})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitOrderBy(operator: plan.OrderBy): NodeData {
    const opI = { i: 0 };
    const args = operator.orders.map(
      (o) => this.processArg(o.key, opI) + (o.ascending ? '' : '&darr;'),
    );
    const parent = this.drawNode(`&tau;(${args.join(', ')})`, operator);
    const bbox = parent.getBBox();
    return {
      el: parent,
      bbox,
      children: [
        operator.source.accept(this.vmap),
        ...operator.orders
          .filter((o) => o.key instanceof plan.Calculation)
          .map((o) => (o.key as PlanOperator).accept(this.vmap))
          .map((el, i) => ({
            ...el,
            connection: {
              src: parent.querySelector<SVGGraphicsElement>(
                `.placeholder-${i}`,
              ),
              edgeType: 'djoin',
            },
          })),
      ],
    };
  }
  visitGroupBy(operator: plan.GroupBy): NodeData {
    const opI = { i: 0 };
    const keys = operator.keys.map((k) => this.processAttr(k, opI));
    const kChildren = opI.i;
    const aggs = operator.aggs.map(
      (a) =>
        `<span class="placeholder placeholder-${opI.i++}">${this.stringifyId(
          a.fieldName,
        )}</span>`,
    );
    const parent = this.drawNode(
      `&gamma;([${keys.join(', ')}]; [${aggs.join(', ')}])`,
      operator,
      'groupby',
    );
    const parentData: NodeData = {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        ...operator.keys
          .filter((k) => k[0] instanceof plan.Calculation)
          .map((k) => (k[0] as PlanOperator).accept(this.vmap))
          .map((el, i) => ({
            ...el,
            connection: {
              src: parent.querySelector<SVGGraphicsElement>(
                `.placeholder-${i}`,
              ),
              edgeType: 'djoin',
            },
          })),
        ...operator.aggs
          .map((a, i) => ({
            ...a.postGroupOp.accept(this.vmap),
            connection: {
              edgeType: 'group-op',
              src: parent.querySelector<SVGGraphicsElement>(
                `.placeholder-${i + kChildren}`,
              ),
            },
          }))
          .map((x) => {
            console.log(x);
            return x;
          }),
      ],
    };
    parent.setAttribute(
      'transform',
      `translate(${GraphBuilder.PADDING}, ${GraphBuilder.PADDING})`,
    );

    const parentTree = this.layout.hierarchy(parentData);
    this.layout(parentTree);

    const groupbyWrapper = this
      .markup<SVGGElement>(`<g style="--lang-color: ${langColors[operator.lang]}"><rect
    ></rect><polygon points="0,0 0,10 10,0" /></g>`);

    const treeContainer = this.getG();
    this.treeContainer.appendChild(treeContainer);
    this.drawSubTree(treeContainer, parentTree);
    const grect = groupbyWrapper.querySelector('rect');
    const bbox = parentTree.extents;
    const grectW = bbox.right - bbox.left + GraphBuilder.PADDING * 2;
    const grectH =
      bbox.bottom -
      bbox.top +
      GraphBuilder.PADDING * 2 -
      GraphBuilder.CHILD_OFFSET;
    grect.setAttribute('width', grectW + '');
    grect.setAttribute('height', grectH + '');
    groupbyWrapper.appendChild(treeContainer);

    parentTree.data.el.parentElement.setAttribute(
      'transform',
      `translate(${GraphBuilder.PADDING - bbox.left}, ${GraphBuilder.PADDING - bbox.top})`,
    );

    return {
      el: groupbyWrapper,
      bbox: { width: grectW, height: grectH },
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitLimit(operator: plan.Limit): NodeData {
    const parent = this.drawNode(
      `limit(${operator.limit}, ${operator.skip})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitUnion(operator: plan.Union): NodeData {
    const parent = this.drawNode('&cup;', operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.left.accept(this.vmap),
        operator.right.accept(this.vmap),
      ],
    };
  }
  visitIntersection(operator: plan.Intersection): NodeData {
    const parent = this.drawNode('&cap;', operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.left.accept(this.vmap),
        operator.right.accept(this.vmap),
      ],
    };
  }
  visitDifference(operator: plan.Difference): NodeData {
    const parent = this.drawNode('&setminus;', operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.left.accept(this.vmap),
        operator.right.accept(this.vmap),
      ],
    };
  }
  visitDistinct(operator: plan.Distinct): NodeData {
    if (operator.attrs === allAttrs) {
      const parent = this.drawNode('&delta;(*)', operator);
      return {
        el: parent,
        bbox: parent.getBBox(),
        children: [operator.source.accept(this.vmap)],
      };
    }
    const opI = { i: 0 };
    const args = operator.attrs.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`&delta;(${args.join(', ')})`, operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.source.accept(this.vmap),
        ...operator.attrs
          .filter((a) => a instanceof plan.Calculation)
          .map((a) => (a as PlanOperator).accept(this.vmap))
          .map((el, i) => ({
            ...el,
            connection: {
              src: parent.querySelector<SVGGraphicsElement>(
                `.placeholder-${i}`,
              ),
              edgeType: 'djoin',
            },
          })),
      ],
    };
  }
  visitNullSource(operator: plan.NullSource): NodeData {
    const parent = this.drawNode(
      '&square;',
      { lang: operator.lang } as PlanOperator, // do not draw schema
      'source-tuple',
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [],
    };
  }
  visitAggregate(operator: plan.AggregateCall): NodeData {
    throw new Error('Method not implemented.');
  }

  protected visitFnSource(
    operator: plan.ItemFnSource | plan.TupleFnSource,
  ): NodeData {
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
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: operator.args
        .filter((a) => a instanceof plan.Calculation)
        .map((a) => (a as PlanOperator).accept(this.vmap))
        .map((el, i) => ({
          ...el,
          connection: {
            src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          },
        })),
    };
  }
  visitItemFnSource(operator: plan.ItemFnSource): NodeData {
    return this.visitFnSource(operator);
  }
  visitTupleFnSource(operator: plan.TupleFnSource): NodeData {
    return this.visitFnSource(operator);
  }
  visitQuantifier(operator: plan.Quantifier): NodeData {
    throw new Error('Method not implemented.');
  }

  visitTreeJoin(operator: TreeJoin): NodeData {
    const parent = this.drawNode('TreeJoin', operator);
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.source.accept(this.vmap),
        {
          ...operator.step.accept(this.vmap),
          connection: { edgeType: 'djoin' },
        },
      ],
    };
  }

  visitProjectionSize(operator: ProjectionSize): NodeData {
    const parent = this.drawNode(
      `size(${this.stringifyId(operator.sizeCol)})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }

  visitRecursion(operator: plan.Recursion): NodeData {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode(
      `&phi;(${operator.min}, ${operator.max}, ${arg})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        src,
        {
          ...operator.condition.accept(this.vmap),
          connection: {
            edgeType: 'djoin',
            src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
          },
        },
      ],
    };
  }

  visitIndexScan(operator: plan.IndexScan): NodeData {
    const arg = this.processArg(operator.access, { i: 0 });
    const parent = this.drawNode(
      `indexScan(${this.stringifyId(operator.name as ASTIdentifier)}, ${arg})`,
      operator,
      'source-tuple',
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        {
          ...operator.access.accept(this.vmap),
          connection: {
            src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
          },
        },
      ],
    };
  }

  visitIndexedRecursion(operator: plan.IndexedRecursion): NodeData {
    const parent = this.drawNode(
      `&phi;&#x20EF; (${operator.min}, ${operator.max})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        operator.source.accept(this.vmap),
        {
          ...operator.mapping.accept(this.vmap),
          connection: { edgeType: 'djoin' },
        },
      ],
    };
  }
  visitBidirectionalRecursion(operator: plan.BidirectionalRecursion): NodeData {
    const parent = this.drawNode(
      `&phi;&#x034D; (${operator.min}, ${operator.max})`,
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [
        {
          ...operator.mappingRev.accept(this.vmap),
          connection: { edgeType: 'djoin' },
        },
        operator.source.accept(this.vmap),
        {
          ...operator.target.accept(this.vmap),
          connection: { edgeType: 'djoin' },
        },
        {
          ...operator.mappingFwd.accept(this.vmap),
          connection: { edgeType: 'djoin' },
        },
      ],
    };
  }
}
