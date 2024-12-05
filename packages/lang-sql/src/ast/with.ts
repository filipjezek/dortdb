import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { ASTIdentifier } from './expression.js';

export enum SearchType {
  DFS = 'bfs',
  BFS = 'dfs',
}

export class WithQuery implements ASTNode {
  public searchCols: ASTIdentifier[];
  public searchType: SearchType;
  public searchName: ASTIdentifier;

  public cycleCols: ASTIdentifier[];
  public cycleMarkName: ASTIdentifier;
  public cyclePathName: ASTIdentifier;
  public cycleMarkVal: ASTNode;
  public cycleMarkDefault: ASTNode;

  constructor(
    public name: ASTIdentifier,
    public colNames: ASTIdentifier[],
    public query: ASTNode,
    public materialized?: boolean
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitWithQuery(this);
  }
}
