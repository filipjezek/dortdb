import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { OrderByItem } from './select.js';

export enum FrameMode {
  RANGE = 'range',
  ROWS = 'rows',
  GROUPS = 'groups',
}

export enum FrameExclusion {
  NO_OTHERS = 'noothers',
  TIES = 'ties',
  CURRENT_ROW = 'currentrow',
  GROUP = 'group',
}

export class WindowSpec implements ASTNode {
  public mode: FrameMode = FrameMode.ROWS;
  public parent: string;
  public order: OrderByItem[];
  public columns: ASTNode[];

  constructor(
    mode?: string,
    public start?: ASTNode,
    public end?: ASTNode,
    public exclude: FrameExclusion = FrameExclusion.NO_OTHERS
  ) {
    this.mode = mode && (mode.toLowerCase() as FrameMode);
  }

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitWindowSpec(this);
  }
}
