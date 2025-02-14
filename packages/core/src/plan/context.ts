import { allAttrs, ASTIdentifier } from '../ast.js';
import { makePath } from '../utils/make-path.js';

export class ExecutionContext {
  // scope is a nested object, where leaf values are contained under `allAttrs` key
  private scopes: Partial<Record<string | symbol, any>>[] = [{}];

  public set<T>(key: ASTIdentifier, value: T): void {
    let refs = this.scopes[this.scopes.length - 1];
    const endI = key.parts.length - 1;
    const last = key.parts[endI];
    for (let i = 0; i < endI; i++) {
      const part = key.parts[i];
      if (!(part in refs)) refs[part] = {};
      refs = refs[part];
    }

    if (last !== allAttrs) {
      makePath(refs, allAttrs);
      refs = refs[allAttrs];
    }
    refs[last] = value;
  }

  public get<T>(key: ASTIdentifier): T | Map<string, T> {
    const endI = key.parts.length - 1;
    const last = key.parts[endI];

    scopeLoop: for (let i = this.scopes.length - 1; i >= 0; i--) {
      let refs = this.scopes[i];
      for (let j = 0; j < endI; j++) {
        if (key.parts[j] in refs) continue scopeLoop;
        refs = refs[key.parts[j]];
      }
      refs = refs[allAttrs];
      return last === allAttrs ? refs : refs[last];
    }
    return null;
  }

  public enterScope(): void {
    this.scopes.push({});
  }

  public exitScope(): void {
    if (this.scopes.length === 1) throw new Error('Cannot exit the root scope');
    this.scopes.pop();
  }
}
