import {
  Aliased,
  allAttrs,
  ASTIdentifier,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '@dortdb/core';
import { isCalc, retI1 } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';
import {
  ProjectionSize,
  TreeJoin,
  XQueryPlanVisitor,
} from '@dortdb/lang-xquery';
import { strToColor } from '../../utils/str-to-color';
import { flextree, FlextreeNode } from 'd3-flextree';
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  PreparedRichInline,
  prepareRichInline,
  RichInlineFragment,
  RichInlineItem,
  RichInlineStats,
  walkRichInlineLineRanges,
} from '@chenglou/pretext/rich-inline';

const langColors: Record<string, string> = {
  xquery: strToColor('xquery'),
  sql: strToColor('sql'),
  cypher: strToColor('cypherx'),
};

interface RichInlineItemMeta {
  title?: string;
  className?: string;
  /** overrides join string */
  joinAfter?: string;
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
  public static readonly SCHEMA_FONT_SIZE = 12;
  public static readonly FONT_SIZE = 15;
  public static readonly TEXT_MAX_WIDTH = 140;
  public static readonly LINE_HEIGHT = 1.2;
  public static readonly SCHEMA_OFFSET = 4;

  protected readonly drawingContainer: SVGGElement;
  protected readonly treeContainer: SVGGElement;
  protected readonly textContainer = document.createElement('p');
  public readonly cssVariables: ReadonlySet<string>;
  protected readonly font: string;
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
          paint-order: stroke;
          font-family: Georgia, Times, 'Times New Roman', serif;
          font-size: ${GraphBuilder.FONT_SIZE}px;

          &:not(text) {
            stroke-width: ${GraphBuilder.STROKE * 2}px;
          }
        }
        svg text, svg tspan {
          stroke-width: 0;
        }
        .text-container {
          fill: var(--mat-sys-on-surface);

          &.source-tuple {
            font-weight: bold;
          }
          &.source-item {
            font-weight: bold;
            font-style: italic;
          }
          .placeholder {
            fill: #546be8;
            font-weight: bold;
          }
          &.groupby .placeholder {
            fill: #a65d1e;
          }
          .schema text, .schema tspan {
            font-size: ${GraphBuilder.SCHEMA_FONT_SIZE}px;
            fill: var(--mat-sys-outline);
            font-weight: normal;
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
      <g id="tree-container"></g>
    `;
    this.cssVariables = new Set(
      Array.from(
        this.container.innerHTML.matchAll(/var\((--[^),]+)\)/g),
        retI1 as any,
      ),
    );
    this.drawingContainer = this.container.querySelector('#drawing-container');
    this.font = getComputedStyle(this.container).font;
    this.treeContainer = this.container.querySelector('#tree-container');
  }

  protected joinRichItems(
    items: (RichInlineItem & RichInlineItemMeta)[],
    joinText: string,
  ): (RichInlineItem & RichInlineItemMeta)[] {
    const joined: (RichInlineItem & RichInlineItemMeta)[] = [];
    items.forEach((item, i) => {
      joined.push(item);
      if (i < items.length - 1) {
        joined.push({ text: item.joinAfter ?? joinText, font: this.font });
      }
    });
    return joined;
  }

  protected richInlineItemToSVG(
    item: RichInlineFragment,
    meta: RichInlineItemMeta,
  ): string {
    let text = this.escapeHtml(item.text);
    if (meta.title) text = `<title>${meta.title}</title>` + text;
    text = `<tspan${meta.className ? ` class="${meta.className}"` : ''} dx="${item.gapBefore}">${text}</tspan>`;
    return text;
  }

  protected richInlineItemsToSVG(
    items: (RichInlineItem & RichInlineItemMeta)[],
    maxWidth: number,
    fontSize = GraphBuilder.FONT_SIZE,
  ): [string, PreparedRichInline, RichInlineStats] {
    const prepared = prepareRichInline(items);
    const stats = measureRichInlineStats(prepared, maxWidth);
    let lineIndex = 0;
    let svg = '';
    walkRichInlineLineRanges(prepared, maxWidth, (lineR) => {
      lineIndex++;
      const y =
        GraphBuilder.LINE_HEIGHT * fontSize * lineIndex -
        ((GraphBuilder.LINE_HEIGHT - 1) / 2) * fontSize;
      svg += `<text
        y="${y}px"
        x="${(stats.maxLineWidth - lineR.width) / 2}px"
      >`;
      const line = materializeRichInlineLineRange(prepared, lineR);
      for (const fragment of line.fragments) {
        const item = items[fragment.itemIndex];
        svg += this.richInlineItemToSVG(fragment, item);
      }
      svg += '</text>';
    });

    return [svg, prepared, stats];
  }

  protected getSchemaTemplate(operator: PlanOperator): string {
    if (!(operator instanceof PlanTupleOperator && operator.schema)) return '';
    const stringified = this.joinRichItems(
      operator.schema.map((id) => this.stringifyId(id)),
      ', ',
    );
    stringified.unshift({ text: '[', font: this.font });
    stringified.push({ text: ']', font: this.font });
    stringified.forEach(
      (item) =>
        (item.font = item.font.replace(
          /\d+px/,
          GraphBuilder.SCHEMA_FONT_SIZE + 'px',
        )),
    );

    const [svg] = this.richInlineItemsToSVG(
      stringified,
      GraphBuilder.TEXT_MAX_WIDTH,
      GraphBuilder.SCHEMA_FONT_SIZE,
    );
    return `<g class="schema">${svg}</g>`;
  }

  protected markup<T extends Element>(template: string): T {
    this.drawingContainer.innerHTML = template;
    return this.drawingContainer.firstElementChild as T;
  }

  protected drawNode(
    name: string | (RichInlineItem & RichInlineItemMeta),
    attrs: (RichInlineItem & RichInlineItemMeta)[][] | null,
    operator: PlanOperator,
    textClass = '',
  ): SVGGElement {
    const schemaTemplate = this.getSchemaTemplate(operator);

    const mainTextParts = attrs
      ? attrs.flatMap((subgroup) => this.joinRichItems(subgroup, ', '))
      : [];
    if (attrs) {
      mainTextParts.unshift({ text: '(', font: this.font });
      mainTextParts.push({ text: ')', font: this.font });
    }
    mainTextParts.unshift(
      typeof name === 'string' ? { text: name, font: this.font } : name,
    );
    const [mainText] = this.richInlineItemsToSVG(
      mainTextParts,
      GraphBuilder.TEXT_MAX_WIDTH,
    );

    const nodeEl = this.markup(`<g class="text-container ${textClass}">
        ${schemaTemplate}
        <g class="main-text">${mainText}</g>
      </g>`);
    const textEl = nodeEl;
    let textBBox = textEl.getBoundingClientRect();
    nodeEl.setAttribute(
      'transform',
      `translate(${GraphBuilder.PADDING}, ${GraphBuilder.PADDING})`,
    );
    const schemaEl = nodeEl.querySelector<SVGGElement>('.schema');
    const mainTextEl = nodeEl.querySelector('.main-text');

    if (schemaEl) {
      const schemaBBox = schemaEl.getBoundingClientRect();
      schemaEl.setAttribute(
        'transform',
        `translate(${(textBBox.width - schemaBBox.width) / 2}, 0)`,
      );
      const mainTextBBox = mainTextEl.getBoundingClientRect();
      mainTextEl.setAttribute(
        'transform',
        `translate(
          ${(textBBox.width - mainTextBBox.width) / 2},
          ${schemaBBox.height + GraphBuilder.SCHEMA_OFFSET}
        )`,
      );
      textBBox = textEl.getBoundingClientRect();
    }

    const result = this.markup<SVGGElement>(`
    <g style="--lang-color: ${langColors[operator.lang]}">
      <rect width="${textBBox.width + GraphBuilder.PADDING * 2}" height="${
        textBBox.height + GraphBuilder.PADDING * 2
      }" />
      <polygon points="0,0 0,10 10,0" />
    </g>
    `);
    result.appendChild(nodeEl);
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
  protected stringifyId(
    id: ASTIdentifier,
  ): RichInlineItem & RichInlineItemMeta {
    const full = id.parts
      .map((x) =>
        typeof x === 'string' ? x : x === allAttrs ? '*' : x?.toString(),
      )
      .join('.');
    if (full.length < 19) {
      return { text: full, font: this.font };
    }
    const truncated = full.slice(0, 16);
    return {
      text: truncated + '…',
      font: this.font,
      title: full,
    };
  }

  protected processAttr(
    [attr, alias]: Aliased<ASTIdentifier | plan.Calculation>,
    counter: { i: number },
  ): (RichInlineItem & RichInlineItemMeta)[] {
    const aliasStr = this.stringifyId(alias);
    if (attr instanceof ASTIdentifier) {
      const attrStr = this.stringifyId(attr);
      return attrStr.text === aliasStr.text
        ? [attrStr]
        : [{ ...aliasStr, joinAfter: '=' }, attrStr];
    }
    return [
      {
        ...aliasStr,
        className: `placeholder placeholder-${counter.i++}`,
        font: 'bold ' + aliasStr.font,
      },
    ];
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
    const attrs = operator.attrs.flatMap((a) => this.processAttr(a, calcI));
    const parent = this.drawNode('π', [attrs], operator);
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
  ): RichInlineItem & RichInlineItemMeta {
    return arg instanceof ASTIdentifier
      ? this.stringifyId(arg)
      : {
          text: '_',
          className: `placeholder placeholder-${counter.i++}`,
          font: 'bold ' + this.font,
        };
  }

  visitSelection(operator: plan.Selection): NodeData {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode('σ', [[arg]], operator);
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
        : this.processAttr(operator.name, { i: 0 })[0];
    const parent = this.drawNode(
      { ...name, font: 'bold ' + name.font },
      null,
      operator,
      'source-tuple',
    );
    return { el: parent, bbox: parent.getBBox(), children: [] };
  }
  visitItemSource(operator: plan.ItemSource): NodeData {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 })[0];
    const parent = this.drawNode(
      { ...name, font: 'italic bold ' + name.font },
      null,
      operator,
      'source-item',
    );
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
    const parent = this.drawNode('calc', [args], operator);
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
    const parent = this.drawNode('×', null, operator);
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
      `${operator.leftOuter ? '°' : ''}⋈${operator.rightOuter ? '°' : ''}`,
      [conditions],
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
      (operator.outer ? '°' : '') + '⋈͢',
      null,
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
      'toItem',
      [[this.stringifyId(operator.key)]],
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
      'fromItem',
      [[this.stringifyId(operator.key)]],
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
      'index',
      [[this.stringifyId(operator.indexCol)]],
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
    const args = operator.orders.map((o) => {
      const arg = this.processArg(o.key, opI);
      if (!o.ascending) {
        arg.text += '↓';
      }
      return arg;
    });
    const parent = this.drawNode('τ', [args], operator);
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
    const keys = operator.keys.flatMap((k) => this.processAttr(k, opI));
    const kChildren = opI.i;
    const aggs = operator.aggs.map((a) => ({
      ...this.stringifyId(a.fieldName),
      className: `placeholder placeholder-${opI.i++}`,
    }));
    const parent = this.drawNode(
      'γ',
      [
        [{ text: '[', font: this.font }],
        keys,
        [{ text: ']; [', font: this.font }],
        aggs,
        [{ text: ']', font: this.font }],
      ],
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
      'limit',
      [[{ text: `${operator.limit}, ${operator.skip}`, font: this.font }]],
      operator,
    );
    return {
      el: parent,
      bbox: parent.getBBox(),
      children: [operator.source.accept(this.vmap)],
    };
  }
  visitUnion(operator: plan.Union): NodeData {
    const parent = this.drawNode('∪', null, operator);
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
    const parent = this.drawNode('∩', null, operator);
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
    const parent = this.drawNode('∖', null, operator);
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
      const parent = this.drawNode('δ(*)', null, operator);
      return {
        el: parent,
        bbox: parent.getBBox(),
        children: [operator.source.accept(this.vmap)],
      };
    }
    const opI = { i: 0 };
    const args = operator.attrs.map((a) => this.processArg(a, opI));
    const parent = this.drawNode('δ', [args], operator);
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
      { text: '□', font: 'bold ' + this.font },
      null,
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
    const fontPrefix =
      operator instanceof plan.ItemFnSource ? 'italic bold ' : 'bold ';
    const name = operator.name
      ? operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 })[0]
      : { text: 'function', font: this.font };
    const parent = this.drawNode(
      { ...name, font: fontPrefix + name.font },
      [args.map((x) => ({ ...x, font: fontPrefix + x.font }))],
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
    const parent = this.drawNode('TreeJoin', null, operator);
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
      'size',
      [[this.stringifyId(operator.sizeCol)]],
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
    const opI = { i: 0 };
    const arg = this.processArg(operator.condition, opI);
    const dedupKeys = operator.distinctKeys.map((k) => this.processArg(k, opI));
    const parent = this.drawNode(
      'φ',
      [
        [{ text: `${operator.min}, ${operator.max}`, font: this.font }, arg],
        [{ text: '; [', font: this.font }],
        dedupKeys,
        [{ text: ']', font: this.font }],
      ],
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
        ...operator.distinctKeys.filter(isCalc).map((k, i) => ({
          ...k.accept(this.vmap),
          connection: {
            src: parent.querySelector<SVGGraphicsElement>(
              `.placeholder-${i + 1}`,
            ),
            edgeType: 'djoin',
          },
        })),
      ],
    };
  }

  visitIndexScan(operator: plan.IndexScan): NodeData {
    const arg = this.processArg(operator.access, { i: 0 });
    const parent = this.drawNode(
      { text: 'indexScan', font: 'bold ' + this.font },
      [
        [this.stringifyId(operator.name as ASTIdentifier), arg].map((x) => ({
          ...x,
          font: 'bold ' + x.font,
        })),
      ],
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
    const opI = { i: 0 };
    const dedupKeys = operator.distinctKeys.map((k) => this.processArg(k, opI));
    const parent = this.drawNode(
      'φ⃯',
      [
        [{ text: `${operator.min}, ${operator.max}; [`, font: this.font }],
        dedupKeys,
        [{ text: `]`, font: this.font }],
      ],
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
        ...operator.distinctKeys.filter(isCalc).map((k, i) => ({
          ...k.accept(this.vmap),
          connection: {
            src: parent.querySelector<SVGGraphicsElement>(
              `.placeholder-${i + 1}`,
            ),
            edgeType: 'djoin',
          },
        })),
      ],
    };
  }
  visitBidirectionalRecursion(operator: plan.BidirectionalRecursion): NodeData {
    const parent = this.drawNode(
      'φ͍',
      [[{ text: `${operator.min}, ${operator.max}`, font: this.font }]],
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
