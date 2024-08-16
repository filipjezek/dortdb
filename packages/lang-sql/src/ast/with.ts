import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';

export enum SearchType {
  DFS = 'bfs',
  BFS = 'dfs',
}

export class WithQuery implements ASTNode {
  public searchCols: string[];
  public searchType: SearchType;
  public searchName: string;

  public cycleCols: string[];
  public cycleMarkName: string;
  public cyclePathName: string;
  public cycleMarkVal: ASTNode;
  public cycleMarkDefault: ASTNode;

  constructor(
    public name: string,
    public colNames: string[],
    public query: ASTNode,
    public materialized?: boolean
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitWithQuery(this);
  }
}
