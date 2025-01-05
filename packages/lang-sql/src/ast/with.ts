import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { SQLIdentifier } from './expression.js';

export enum SearchType {
  DFS = 'bfs',
  BFS = 'dfs',
}

export class WithQuery implements ASTNode {
  public recursive = false;

  public searchCols: SQLIdentifier[];
  public searchType: SearchType;
  public searchName: SQLIdentifier;

  public cycleCols: SQLIdentifier[];
  public cycleMarkName: SQLIdentifier;
  public cyclePathName: SQLIdentifier;
  public cycleMarkVal: ASTNode;
  public cycleMarkDefault: ASTNode;

  constructor(
    public name: SQLIdentifier,
    public colNames: SQLIdentifier[],
    public query: ASTNode,
    public materialized?: boolean
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitWithQuery(this);
  }
}
