export enum Keywords {
  FOR = 'FOR',
  LET = 'LET',
  WHERE = 'WHERE',
  RETURN = 'RETURN',
  AS = 'AS',
  ALLOWING = 'ALLOWING',
  EMPTY = 'EMPTY',
  AT = 'AT',
  TUMBLING = 'TUMBLING',
  SLIDING = 'SLIDING',
  WINDOW = 'WINDOW',
  START = 'START',
  ONLY = 'ONLY',
  END = 'END',
  PREVIOUS = 'PREVIOUS',
  NEXT = 'NEXT',
  COUNT = 'COUNT',
  GROUPBY = 'GROUPBY',
  STABLE = 'STABLE',
  ORDERBY = 'ORDERBY',
  ASCENDING = 'ASCENDING',
  DESCENDING = 'DESCENDING',
  GREATEST = 'GREATEST',
  LEAST = 'LEAST',
  WHEN = 'WHEN',
  SWITCH = 'SWITCH',
  CASE = 'CASE',
  DEFAULT = 'DEFAULT',
  CAST = 'CAST',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  EVERY = 'EVERY',
  SOME = 'SOME',
  INSTANCEOF = 'INSTANCEOF',
  SATISFIES = 'SATISFIES',
  AND = 'AND',
  OR = 'OR',
  IN = 'IN',
  TO = 'TO',
  DIV = 'DIV',
  IDIV = 'IDIV',
  MOD = 'MOD',
  CHILD = 'CHILD',
  DESCENDANT = 'DESCENDANT',
  PARENT = 'PARENT',
  ANCESTOR = 'ANCESTOR',
  FOLLOWING_SIBLING = 'FOLLOWING_SIBLING',
  PRECEDING_SIBLING = 'PRECEDING_SIBLING',
  FOLLOWING = 'FOLLOWING',
  PRECEDING = 'PRECEDING',
  ATTRIBUTE = 'ATTRIBUTE',
  SELF = 'SELF',
  DESCENDANT_OR_SELF = 'DESCENDANT_OR_SELF',
  ANCESTOR_OR_SELF = 'ANCESTOR_OR_SELF',
  NODE = 'NODE',
  TEXT = 'TEXT',
  COMMENT = 'COMMENT',
  NAMESPACENODE = 'NAMESPACENODE',
  ELEMENT = 'ELEMENT',
  SCHEMA_ELEMENT = 'SCHEMA_ELEMENT',
  DOCUMENT_NODE = 'DOCUMENT_NODE',
  DECLARE = 'DECLARE',
  NAMESPACE = 'NAMESPACE',
  ORDERED = 'ORDERED',
  UNORDERED = 'UNORDERED',
  BASEURI = 'BASEURI',
  ORDERING = 'ORDERING',
  ORDER = 'ORDER',
  KW_EQ = 'KW_EQ',
  KW_NEQ = 'KW_NEQ',
  KW_LT = 'KW_LT',
  KW_LTE = 'KW_LTE',
  KW_GT = 'KW_GT',
  KW_GTE = 'KW_GTE',
  IS = 'IS',
  UNION = 'UNION',
  INTERSECT = 'INTERSECT',
  EXCEPT = 'EXCEPT',
  EMPTYSEQ = 'EMPTYSEQ',
  ITEM = 'ITEM',
  SCHEMA_ATTRIBUTE = 'SCHEMA_ATTRIBUTE',
  PROC_INSTR = 'PROC_INSTR',
  FUNCTION = 'FUNCTION',
}

export enum AdditionalTokens {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  QNAME = 'QNAME',
  NCNAME = 'NCNAME',
  QNAME_WILDCARD = 'QNAME_WILDCARD',
  XMLLIT = 'XMLLIT',
  LANGSWITCH = 'LANGSWITCH',
  LANGEXIT = 'LANGEXIT',

  COMMA = 'COMMA',
  DOT = 'DOT',
  DOLLAR = 'DOLLAR',
  LPAR = 'LPAR',
  DBLLPAR = 'DBLLPAR',
  RPAR = 'RPAR',
  LBRA = 'LBRA',
  RBRA = 'RBRA',
  RCUR = 'RCUR',
  CLOSEDBRAS = 'CLOSEDBRAS',
  SEMICOLON = 'SEMICOLON',
  COLON = 'COLON',
  COLONEQ = 'COLONEQ',
  DBLCOLON = 'DBLCOLON',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  DBLSLASH = 'DBLSLASH',
  PIPE = 'PIPE',
  DBLPIPE = 'DBLPIPE',
  EXP = 'EXP',
  EQ = 'EQ',
  NEQ = 'NEQ',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  SHIFTL = 'SHIFTL',
  SHIFTR = 'SHIFTR',
  QUESTION = 'QUESTION',
  EMPH = 'EMPH',
  AT_SIGN = 'AT_SIGN',

  DIREL_SELFEND = 'DIREL_SELFEND',
  WS = 'WS',
  DIRCOMMENT_START = 'DIRCOMMENT_START',
  DIRCOMMENT_END = 'DIRCOMMENT_END',
  DIRPI_START = 'DIRPI_START',
  DIRPI_END = 'DIRPI_END',
  ATTR_CONTENT = 'ATTR_CONTENT',
  DIREL_CONTENT = 'DIREL_CONTENT',
  COMMENT_CONTENT = 'COMMENT_CONTENT',
  PI_CONTENT = 'PI_CONTENT',
}
