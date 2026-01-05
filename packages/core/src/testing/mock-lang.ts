import { Language } from '../lang-manager.js';

export const parseExprSpy = vi.fn();
export const buildPlanSpy = vi.fn();
export const executeSpy = vi.fn();
export const mockLang: Language = {
  name: 'lang',
  visitors: {
    executor: class {
      execute = executeSpy;
    } as any,
    logicalPlanBuilder: class {
      buildPlan = buildPlanSpy;
    } as any,
  },
  aggregates: [],
  functions: [],
  operators: [],
  castables: [],
  serialize: () => ({ data: [] }),
  createParser: () => ({ parseExpr: parseExprSpy }) as any,
};
