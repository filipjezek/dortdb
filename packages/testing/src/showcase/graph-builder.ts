import {
  Aliased,
  allAttrs,
  ASTIdentifier,
  LogicalPlanOperator,
  LogicalPlanVisitor,
  operators,
} from '@dortdb/core';

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

export class GraphBuilder implements LogicalPlanVisitor<SVGGElement> {
  private readonly drawingContainer: SVGGElement;
  private readonly textContainer = document.createElement('p');

  constructor(
    private readonly container: SVGSVGElement,
    private vmap: Record<string, LogicalPlanVisitor<SVGGElement>>
  ) {
    this.container.innerHTML = `
      <style>
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
            color: #888888;
            font-weight: normal;
            margin: 0 auto 4px;
          }
        }
        rect {
          fill: white;
          stroke: #888888;

          &:has(+ foreignObject > .groupby) {
            stroke: white;
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
    this.drawingContainer = this.container.querySelector('#drawing-container');
  }

  private drawNode(
    text: string,
    schema?: ASTIdentifier[],
    textClass = ''
  ): SVGGElement {
    const schemaTemplate =
      schema &&
      `<div class="schema">[${schema
        .map((id) => this.stringifyId(id))
        .join(', ')}]</div>`;

    this.drawingContainer.innerHTML = `<foreignObject height="2000" width="200">
      <div class="${textClass}">
        ${schemaTemplate ?? ''}
        ${text}
      </div>
    </foreignObject>`;
    const foEl = this.drawingContainer.firstElementChild as SVGTextElement;
    const textEl = foEl.firstElementChild as HTMLElement;
    const textBBox = textEl.getBoundingClientRect();
    foEl.setAttribute('width', textBBox.width + '');
    foEl.setAttribute('height', textBBox.height + '');

    this.drawingContainer.innerHTML = `
    <g>
      <rect width="${textBBox.width + PADDING * 2}" height="${
      textBBox.height + PADDING * 2
    }"></rect>
    </g>
    `;
    this.drawingContainer.firstElementChild.appendChild(foEl);
    foEl.setAttribute(
      'y',
      (textBBox.height - textBBox.height) / 2 + PADDING + ''
    );
    foEl.setAttribute(
      'x',
      (textBBox.width - textBBox.width) / 2 + PADDING + ''
    );
    return this.drawingContainer.firstElementChild as SVGGElement;
  }

  private getG(): SVGGElement {
    this.drawingContainer.innerHTML = '<g></g>';
    return this.drawingContainer.firstElementChild as SVGGElement;
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
          : x?.toString()
      )
      .join('.');
    if (full.length < 18) {
      return full;
    }
    return `<span title="${this.escapeAttr(full)}">${full.slice(
      0,
      15
    )}&hellip;</span>`;
  }

  private processAttr(
    [attr, alias]: Aliased<ASTIdentifier | operators.Calculation>,
    counter: { i: number }
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
    const root = plan.accept(this.vmap);
    this.drawingContainer.innerHTML = '';
    root.setAttribute('transform', `translate(${STROKE}, ${STROKE})`);
    this.container.appendChild(root);
    const bbox = root.getBBox();
    this.container.setAttribute('width', `${bbox.width + STROKE * 2}`);
    this.container.setAttribute('height', `${bbox.height + STROKE * 2}`);
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
      `translate(${(totalWidth - parentBBox.width) / 2 + ''}, 0)`
    );
    const srcBBoxes = branches.map((b) => b.src?.getBoundingClientRect());
    let x = (totalWidth - childrenWidth) / 2;
    for (let i = 0; i < branches.length; i++) {
      branches[i].el.setAttribute(
        'transform',
        `translate(${x}, ${parentBBox.height + CHILD_OFFSET})`
      );

      const edge = this.drawEdge(
        srcBBoxes[i],
        branches[i].edgeType,
        bboxes[i],
        parentBBox,
        totalWidth,
        x
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
    x: number
  ) {
    if (srcBBox) {
      this.drawingContainer.innerHTML = `<line
        x1="${srcBBox.x - parent.x + srcBBox.width / 2}"
        y1="${srcBBox.y - parent.y + srcBBox.height}"
        x2="${x + bbox.width / 2}"
        y2="${parent.height + CHILD_OFFSET}"
      ></line>`;
    } else {
      this.drawingContainer.innerHTML = `<line
        x1="${totalWidth / 2}"
        y1="${parent.height / 2}"
        x2="${x + bbox.width / 2}"
        y2="${parent.height + CHILD_OFFSET}"
      ></line>`;
    }
    const edge = this.drawingContainer.firstElementChild;
    if (edgeType) {
      edge.classList.add(edgeType);
    }
    return edge;
  }

  visitProjection(operator: operators.Projection): SVGGElement {
    const src = operator.source.accept(this.vmap);
    const calcI = { i: 0 };
    const attrs = operator.attrs.map((a) => this.processAttr(a, calcI));
    const parent = this.drawNode(
      `&pi;(${attrs.map((a) => a).join(', ')})`,
      operator.schema
    );
    const calcs = operator.attrs
      .filter((a) => a[0] instanceof operators.Calculation)
      .map(([a]) => this.visitCalculation(a as operators.Calculation))
      .map((el, i) => ({
        el,
        edgeType: 'djoin',
        src: parent.querySelector<SVGGraphicsElement>('.placeholder-' + i),
      }));
    return this.drawBranches(parent, { el: src }, ...calcs);
  }

  private processArg(
    arg: ASTIdentifier | LogicalPlanOperator,
    counter: { i: number }
  ) {
    return arg instanceof ASTIdentifier
      ? this.stringifyId(arg)
      : `<span class="placeholder placeholder-${counter.i++}">_</span>`;
  }

  visitSelection(operator: operators.Selection): SVGGElement {
    const src = operator.source.accept(this.vmap);
    const arg = this.processArg(operator.condition, { i: 0 });
    const parent = this.drawNode(`&sigma;(${arg})`, operator.schema);
    return operator.condition instanceof ASTIdentifier
      ? this.drawBranches(parent, { el: src })
      : this.drawBranches(
          parent,
          { el: src },
          {
            el: operator.condition.accept(this.vmap),
            edgeType: 'djoin',
            src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
          }
        );
  }
  visitTupleSource(operator: operators.TupleSource): SVGGElement {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    return this.drawNode(name, operator.schema, 'source-tuple');
  }
  visitItemSource(operator: operators.ItemSource): SVGGElement {
    const name =
      operator.name instanceof ASTIdentifier
        ? this.stringifyId(operator.name)
        : this.processAttr(operator.name, { i: 0 });
    return this.drawNode(name, null, 'source-item');
  }
  visitFnCall(operator: operators.FnCall): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: operators.Literal): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: operators.Calculation): SVGGElement {
    let opI = { i: 0 };
    const args = operator.args.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`calc(${args.join(', ')})`);
    const ops = operator.args
      .filter((a) => !(a instanceof ASTIdentifier))
      .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
      .map((el, i) => ({
        el,
        src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
      }));
    return this.drawBranches(parent, ...ops);
  }
  visitConditional(operator: operators.Conditional): SVGGElement {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: operators.CartesianProduct): SVGGElement {
    const parent = this.drawNode('&times;', operator.schema);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) }
    );
  }
  visitJoin(operator: operators.Join): SVGGElement {
    const condition = this.processArg(operator.on, { i: 0 });
    const parent = this.drawNode(
      `${operator.leftOuter ? '&deg;' : ''}&bowtie;${
        operator.rightOuter ? '&deg;' : ''
      }(${condition})`,
      operator.schema
    );
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      {
        el: operator.on.accept(this.vmap),
        edgeType: 'djoin',
        src: parent.querySelector<SVGGraphicsElement>('.placeholder-0'),
      },
      { el: operator.right.accept(this.vmap) }
    );
  }
  visitProjectionConcat(operator: operators.ProjectionConcat): SVGGElement {
    const parent = this.drawNode(
      (operator.outer ? '&deg;' : '') + '&bowtie;&#x0362;',
      operator.schema
    );
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      { el: operator.mapping.accept(this.vmap), edgeType: 'djoin' }
    );
  }
  visitMapToItem(operator: operators.MapToItem): SVGGElement {
    const parent = this.drawNode(`toItem(${this.stringifyId(operator.key)})`);
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitMapFromItem(operator: operators.MapFromItem): SVGGElement {
    const parent = this.drawNode(
      `fromItem(${this.stringifyId(operator.key)})`,
      operator.schema
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitProjectionIndex(operator: operators.ProjectionIndex): SVGGElement {
    const parent = this.drawNode(
      `index(${this.stringifyId(operator.indexCol)})`,
      operator.schema
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitOrderBy(operator: operators.OrderBy): SVGGElement {
    let opI = { i: 0 };
    const args = operator.orders.map(
      (o) => this.processArg(o.key, opI) + (o.ascending ? '' : '&darr;')
    );
    const parent = this.drawNode(`&tau;(${args.join(', ')})`, operator.schema);
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      ...operator.orders
        .filter((o) => o.key instanceof operators.Calculation)
        .map((o) => (o.key as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          edgeType: 'djoin',
        }))
    );
  }
  visitGroupBy(operator: operators.GroupBy): SVGGElement {
    let opI = { i: 0 };
    const keys = operator.keys.map((k) => this.processAttr(k, opI));
    const kChildren = opI.i;
    const aggs = operator.aggs.map(
      (a) =>
        `<span class="placeholder placeholder-${opI.i++}">${this.stringifyId(
          a.fieldName
        )}</span>`
    );
    let parent = this.drawNode(
      `&gamma;(${keys.join(', ')}; ${aggs.join(', ')})`,
      operator.schema,
      'groupby'
    );
    parent = this.drawBranches(
      parent,
      ...operator.keys
        .filter((k) => k instanceof operators.Calculation)
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
          `.placeholder-${i + kChildren}`
        ),
      }))
    );
    this.drawingContainer.appendChild(parent);
    const bbox = parent.getBBox();
    this.drawingContainer.innerHTML = `<g><rect
      x="0"
      y="0"
      width="${bbox.width + PADDING * 2}"
      height="${bbox.height + PADDING * 2}"
    ></rect></g>`;
    parent.setAttribute('transform', `translate(${PADDING}, ${PADDING})`);
    this.drawingContainer.firstElementChild.appendChild(parent);
    parent = this.drawingContainer.firstElementChild as SVGGElement;

    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitLimit(operator: operators.Limit): SVGGElement {
    const parent = this.drawNode(
      `limit(${operator.limit}, ${operator.skip})`,
      operator.schema
    );
    return this.drawBranches(parent, { el: operator.source.accept(this.vmap) });
  }
  visitUnion(operator: operators.Union): SVGGElement {
    const parent = this.drawNode('&cup;', operator.schema);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) }
    );
  }
  visitIntersection(operator: operators.Intersection): SVGGElement {
    const parent = this.drawNode('&cap;', operator.schema);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) }
    );
  }
  visitDifference(operator: operators.Difference): SVGGElement {
    const parent = this.drawNode('&setminus;', operator.schema);
    return this.drawBranches(
      parent,
      { el: operator.left.accept(this.vmap) },
      { el: operator.right.accept(this.vmap) }
    );
  }
  visitDistinct(operator: operators.Distinct): SVGGElement {
    if (operator.attrs === allAttrs) {
      const parent = this.drawNode('&delta;(*)', operator.schema);
      return this.drawBranches(parent, {
        el: operator.source.accept(this.vmap),
      });
    }
    const opI = { i: 0 };
    const args = operator.attrs.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(`&delta;(${args.join(', ')})`);
    return this.drawBranches(
      parent,
      { el: operator.source.accept(this.vmap) },
      ...operator.attrs
        .filter((a) => a instanceof operators.Calculation)
        .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
          edgeType: 'djoin',
        }))
    );
  }
  visitNullSource(operator: operators.NullSource): SVGGElement {
    return this.drawNode('&square;', operator.schema, 'source-tuple');
  }
  visitAggregate(operator: operators.AggregateCall): SVGGElement {
    throw new Error('Method not implemented.');
  }

  private visitFnSource(
    operator: operators.ItemFnSource | operators.TupleFnSource
  ): SVGGElement {
    const opI = { i: 0 };
    const args = operator.args.map((a) => this.processArg(a, opI));
    const parent = this.drawNode(
      `function(${args.join(', ')})`,
      (operator as operators.TupleFnSource).schema,
      'source-' +
        (operator instanceof operators.ItemFnSource ? 'item' : 'tuple')
    );
    return this.drawBranches(
      parent,
      ...operator.args
        .filter((a) => a instanceof operators.Calculation)
        .map((a) => (a as LogicalPlanOperator).accept(this.vmap))
        .map((el, i) => ({
          el,
          src: parent.querySelector<SVGGraphicsElement>(`.placeholder-${i}`),
        }))
    );
  }
  visitItemFnSource(operator: operators.ItemFnSource): SVGGElement {
    return this.visitFnSource(operator);
  }
  visitTupleFnSource(operator: operators.TupleFnSource): SVGGElement {
    return this.visitFnSource(operator);
  }
  visitQuantifier(operator: operators.Quantifier): SVGGElement {
    throw new Error('Method not implemented.');
  }
}
