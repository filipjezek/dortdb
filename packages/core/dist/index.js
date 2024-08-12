class ASTLiteral {
  constructor(original, value) {
    this.original = original;
    this.value = value;
  }
  accept(visitor) {
    visitor.acceptLiteral(this);
  }
}
class ASTOperator {
  constructor(lang, id, operands) {
    this.lang = lang;
    this.id = id;
    this.operands = operands;
  }
  accept(visitor) {
    visitor.acceptOperator(this);
  }
}
class ASTFunction {
  constructor(lang, id, args) {
    this.lang = lang;
    this.id = id;
    this.args = args;
  }
  accept(visitor) {
    visitor.acceptFunction(this);
  }
}

function makePath(src, ...parts) {
  for (const part of parts) {
    if (!(part in src)) {
      src[part] = {};
    }
    src = src[part];
  }
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
const _LanguageManager = class _LanguageManager {
  constructor() {
    __publicField$1(this, "langs", {});
    __publicField$1(this, "implementations", {
      [_LanguageManager.allLangs]: {
        [_LanguageManager.defaultSchema]: {
          operators: {},
          functions: {},
          aggregates: {}
        }
      }
    });
  }
  registerExtension(ext) {
    const scope = ext.scope ?? [_LanguageManager.allLangs];
    const schema = ext.schema ?? _LanguageManager.defaultSchema;
    for (const lang of scope) {
      makePath(this.implementations, lang, schema);
      const ims = this.implementations[lang][schema];
      for (const type of ["operators", "functions", "aggregates"]) {
        ims[type] = ims[type] ?? {};
        for (const item of ext[type]) {
          ims[type][item.name] = item;
        }
      }
    }
  }
  registerLang(lang) {
    this.langs[lang.name.toLowerCase()] = lang;
    this.registerExtension({ ...lang, scope: [lang.name] });
  }
  getLang(name) {
    return this.langs[name.toLowerCase()];
  }
  getOp(lang, name, schema) {
    return this.getImplementation("operators", lang, name, schema);
  }
  getFn(lang, name, schema) {
    return this.getImplementation("functions", lang, name, schema);
  }
  getAggr(lang, name, schema) {
    return this.getImplementation("aggregates", lang, name, schema);
  }
  getImplementation(type, lang, name, schema = _LanguageManager.defaultSchema) {
    let impl = this.implementations[lang]?.[schema]?.[type][name];
    impl = impl ?? this.implementations[_LanguageManager.allLangs][schema]?.[type][name];
    return impl;
  }
};
__publicField$1(_LanguageManager, "allLangs", Symbol("allLangs"));
__publicField$1(_LanguageManager, "defaultSchema", Symbol("defaultSchema"));
let LanguageManager = _LanguageManager;

const add = {
  name: "+",
  impl: (a, b) => b === void 0 ? +a : a + b
};
const subtract = {
  name: "-",
  impl: (a, b) => b === void 0 ? -a : a - b
};
const multiply = {
  name: "*",
  impl: (a, b) => a * b
};
const divide = {
  name: "/",
  impl: (a, b) => a / b
};
const mod = {
  name: "%",
  impl: (a, b) => a % b
};
const pow = {
  name: "^",
  impl: (a, b) => Math.pow(a, b)
};

var arithmetic = /*#__PURE__*/Object.freeze({
  __proto__: null,
  add: add,
  divide: divide,
  mod: mod,
  multiply: multiply,
  pow: pow,
  subtract: subtract
});

const operators = [...Object.values(arithmetic)];

const core = {
  operators,
  functions: [],
  aggregates: []
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, key + "" , value);
class DortDB {
  constructor(config) {
    this.config = config;
    __publicField(this, "langMgr");
    this.langMgr = new LanguageManager();
    this.langMgr.registerExtension(core);
    this.langMgr.registerLang(config.mainLang);
    this.config.additionalLangs?.forEach(
      (lang) => this.langMgr.registerLang(lang)
    );
    this.config.extensions?.forEach((e) => this.langMgr.registerExtension(e));
  }
  parse(query) {
    return this.langMgr.getLang(this.config.mainLang.name).createParser(this.langMgr).parse(query);
  }
}

export { ASTFunction, ASTLiteral, ASTOperator, DortDB, LanguageManager, core };
//# sourceMappingURL=index.js.map
