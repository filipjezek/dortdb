import { allAttrs, ASTIdentifier } from '../ast.js';

export class ExecutionContext {
  // scope is a nested object, where leaf values are contained under `allAttrs` key
  private scopes: Partial<Record<string | typeof allAttrs, any>>[] = [{}];

  public set<T>(key: ASTIdentifier, value: T): void {
    let refs = this.scopes[this.scopes.length - 1];
    for (let schema of key.schemaParts) {
      if (!(schema in refs)) refs[schema] = {};
      refs = refs[schema];
    }
    if (key.id === allAttrs) {
      refs[allAttrs] = value;
      return;
    }

    if (allAttrs in refs) refs[allAttrs] = {};
    refs = refs[allAttrs];
    refs[key.id] = value;
  }

  public get<T>(key: ASTIdentifier): T | Map<string, T> {
    const end =
      key.id === allAttrs ? key.schemaParts.length - 1 : key.schemaParts.length;

    scopeLoop: for (let i = this.scopes.length - 1; i >= 0; i--) {
      let refs = this.scopes[i];
      for (let j = 0; j < end; j++) {
        if (key.schemaParts[j] in refs) continue scopeLoop;
        refs = refs[key.schemaParts[j]];
      }
      refs = refs[allAttrs];
      return refs[key.id === allAttrs ? key.schemaParts[end] : key.id];
    }
  }

  public enterScope(): void {
    this.scopes.push({});
  }

  public exitScope(): void {
    if (this.scopes.length === 1) throw new Error('Cannot exit the root scope');
    this.scopes.pop();
  }
}
