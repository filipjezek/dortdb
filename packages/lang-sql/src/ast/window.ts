import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { OrderByItem } from './select.js';

/** The unit used to define a window frame boundary. */
export enum FrameMode {
  /** Logical `RANGE` mode: rows within the peer group of the boundary value. */
  RANGE = 'range',
  /** Physical `ROWS` mode: exact row offsets from the current row. */
  ROWS = 'rows',
  /** `GROUPS` mode: peer-group offsets from the current row. */
  GROUPS = 'groups',
}

/** Rows excluded from the window frame. */
export enum FrameExclusion {
  /** `EXCLUDE NO OTHERS` (default): no rows excluded. */
  NO_OTHERS = 'noothers',
  /** `EXCLUDE TIES`: exclude peer rows of the current row but not the current row itself. */
  TIES = 'ties',
  /** `EXCLUDE CURRENT ROW`: exclude only the current row. */
  CURRENT_ROW = 'currentrow',
  /** `EXCLUDE GROUP`: exclude the current row and all its peers. */
  GROUP = 'group',
}

/**
 * Window specification for a window function or `OVER` clause.
 */
export class WindowSpec implements ASTNode {
  /** Frame mode; defaults to `ROWS`. */
  public mode: FrameMode = FrameMode.ROWS;
  /** Name of the window this spec inherits from; `undefined` if standalone. */
  public parent: string;
  /** `ORDER BY` expressions within the window. */
  public order: OrderByItem[];
  /** `PARTITION BY` expressions. */
  public columns: ASTNode[];

  constructor(
    mode?: string,
    /** Frame start boundary expression. */
    public start?: ASTNode,
    /** Frame end boundary expression; `undefined` for a single-sided frame. */
    public end?: ASTNode,
    /** Which rows are excluded from the frame. */
    public exclude: FrameExclusion = FrameExclusion.NO_OTHERS,
  ) {
    this.mode = mode && (mode.toLowerCase() as FrameMode);
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWindowSpec(this, arg);
  }
}
