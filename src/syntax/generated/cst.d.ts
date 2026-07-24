import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface Optional_whitespaceCstNode extends CstNode {
  name: "optional_whitespace";
  children: Optional_whitespaceCstChildren;
}

export type Optional_whitespaceCstChildren = {
  WhiteSpace?: IToken[];
};

export interface ExpressionEntryCstNode extends CstNode {
  name: "expressionEntry";
  children: ExpressionEntryCstChildren;
}

export type ExpressionEntryCstChildren = {
  optional_whitespace: (Optional_whitespaceCstNode)[];
  expression: ExpressionCstNode[];
  EOF: IToken[];
};

export interface ExpressionCstNode extends CstNode {
  name: "expression";
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  conditionalExpression: ConditionalExpressionCstNode[];
};

export interface ConditionalExpressionCstNode extends CstNode {
  name: "conditionalExpression";
  children: ConditionalExpressionCstChildren;
}

export type ConditionalExpressionCstChildren = {
  condition: BinaryExpressionCstNode[];
  optional_whitespace?: (Optional_whitespaceCstNode)[];
  Question?: IToken[];
  trueBranch?: ExpressionCstNode[];
  Colon?: IToken[];
  falseBranch?: ConditionalExpressionCstNode[];
};

export interface BinaryExpressionCstNode extends CstNode {
  name: "binaryExpression";
  children: BinaryExpressionCstChildren;
}

export type BinaryExpressionCstChildren = {
  lhs: UnaryExpressionCstNode[];
  optional_whitespace?: (Optional_whitespaceCstNode)[];
  operator?: IToken[];
  rhs?: UnaryExpressionCstNode[];
};

export interface UnaryExpressionCstNode extends CstNode {
  name: "unaryExpression";
  children: UnaryExpressionCstChildren;
}

export type UnaryExpressionCstChildren = {
  operator?: IToken[];
  optional_whitespace?: Optional_whitespaceCstNode[];
  operand: DiceWithModifiersCstNode[];
};

export interface DiceWithModifiersCstNode extends CstNode {
  name: "diceWithModifiers";
  children: DiceWithModifiersCstChildren;
}

export type DiceWithModifiersCstChildren = {
  base: DiceExpressionCstNode[];
  modifier?: ModifierCstNode[];
};

export interface DiceExpressionCstNode extends CstNode {
  name: "diceExpression";
  children: DiceExpressionCstChildren;
}

export type DiceExpressionCstChildren = {
  count?: AtomCstNode[];
  tail?: DiceTailCstNode[];
  pureTail?: DiceTailCstNode[];
};

export interface DiceTailCstNode extends CstNode {
  name: "diceTail";
  children: DiceTailCstChildren;
}

export type DiceTailCstChildren = {
  Df?: IToken[];
  Dc?: IToken[];
  D?: IToken[];
  sides?: AtomCstNode[];
};

export interface AtomCstNode extends CstNode {
  name: "atom";
  children: AtomCstChildren;
}

export type AtomCstChildren = {
  NumberLiteral?: IToken[];
  BooleanLiteral?: IToken[];
  NamedExpression?: IToken[];
  listExpression?: ListExpressionCstNode[];
  regularFunctionCall?: RegularFunctionCallCstNode[];
  filterCall?: FilterCallCstNode[];
  repeatForm?: RepeatFormCstNode[];
  critForm?: CritFormCstNode[];
  LParen?: IToken[];
  optional_whitespace?: (Optional_whitespaceCstNode)[];
  wrappedExpression?: ExpressionCstNode[];
  RParen?: IToken[];
};

export interface ListExpressionCstNode extends CstNode {
  name: "listExpression";
  children: ListExpressionCstChildren;
}

export type ListExpressionCstChildren = {
  LBracket: IToken[];
  optional_whitespace: (Optional_whitespaceCstNode)[];
  element?: ExpressionCstNode[];
  Comma?: IToken[];
  elements?: ExpressionCstNode[];
  RBracket: IToken[];
};

export interface RegularFunctionCallCstNode extends CstNode {
  name: "regularFunctionCall";
  children: RegularFunctionCallCstChildren;
}

export type RegularFunctionCallCstChildren = {
  BuiltinFunction: IToken[];
  LParen: IToken[];
  optional_whitespace: (Optional_whitespaceCstNode)[];
  arg: ExpressionCstNode[];
  Comma?: IToken[];
  args?: ExpressionCstNode[];
  RParen: IToken[];
};

export interface FilterCallCstNode extends CstNode {
  name: "filterCall";
  children: FilterCallCstChildren;
}

export type FilterCallCstChildren = {
  Filter: IToken[];
  modParam: ModParamCstNode[];
  LParen: IToken[];
  optional_whitespace: (Optional_whitespaceCstNode)[];
  arg: ExpressionCstNode[];
  Comma?: IToken[];
  args?: ExpressionCstNode[];
  RParen: IToken[];
};

export interface RepeatFormCstNode extends CstNode {
  name: "repeatForm";
  children: RepeatFormCstChildren;
}

export type RepeatFormCstChildren = {
  RepeatForm: IToken[];
  LParen: IToken[];
  optional_whitespace: (Optional_whitespaceCstNode)[];
  expression: ExpressionCstNode[];
  Comma: IToken[];
  count: ExpressionCstNode[];
  RParen: IToken[];
};

export interface CritFormCstNode extends CstNode {
  name: "critForm";
  children: CritFormCstChildren;
}

export type CritFormCstChildren = {
  CritForm: IToken[];
  LParen: IToken[];
  optional_whitespace: (Optional_whitespaceCstNode)[];
  expression: ExpressionCstNode[];
  RParen: IToken[];
};

export interface ModifierCstNode extends CstNode {
  name: "modifier";
  children: ModifierCstChildren;
}

export type ModifierCstChildren = {
  keepDropModifier?: KeepDropModifierCstNode[];
  minMaxModifier?: MinMaxModifierCstNode[];
  rerollModifier?: RerollModifierCstNode[];
  explodeModifier?: ExplodeModifierCstNode[];
  successFailureModifier?: SuccessFailureModifierCstNode[];
};

export interface KeepDropModifierCstNode extends CstNode {
  name: "keepDropModifier";
  children: KeepDropModifierCstChildren;
}

export type KeepDropModifierCstChildren = {
  KeepDropModifierOperator: IToken[];
  count?: AtomCstNode[];
};

export interface MinMaxModifierCstNode extends CstNode {
  name: "minMaxModifier";
  children: MinMaxModifierCstChildren;
}

export type MinMaxModifierCstChildren = {
  MinMaxModifierOperator: IToken[];
  value: AtomCstNode[];
};

export interface RerollModifierCstNode extends CstNode {
  name: "rerollModifier";
  children: RerollModifierCstChildren;
}

export type RerollModifierCstChildren = {
  R: IToken[];
  modParam: ModParamCstNode[];
  limit?: LimitCstNode[];
};

export interface ExplodeModifierCstNode extends CstNode {
  name: "explodeModifier";
  children: ExplodeModifierCstChildren;
}

export type ExplodeModifierCstChildren = {
  X: IToken[];
  modParam?: ModParamCstNode[];
  limit?: LimitCstNode[];
};

export interface SuccessFailureModifierCstNode extends CstNode {
  name: "successFailureModifier";
  children: SuccessFailureModifierCstChildren;
}

export type SuccessFailureModifierCstChildren = {
  SuccessFailureModifierOperator: IToken[];
  modParam: ModParamCstNode[];
};

export interface ModParamCstNode extends CstNode {
  name: "modParam";
  children: ModParamCstChildren;
}

export type ModParamCstChildren = {
  LBracket: IToken[];
  CompareOperator?: IToken[];
  atom: AtomCstNode[];
  RBracket: IToken[];
};

export interface LimitCstNode extends CstNode {
  name: "limit";
  children: LimitCstChildren;
}

export type LimitCstChildren = {
  Lt?: (IToken)[];
  timeLimit1?: AtomCstNode[];
  Lc?: (IToken)[];
  countLimit1?: AtomCstNode[];
  countLimit2?: AtomCstNode[];
  timeLimit2?: AtomCstNode[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  optional_whitespace(children: Optional_whitespaceCstChildren, param?: IN): OUT;
  expressionEntry(children: ExpressionEntryCstChildren, param?: IN): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  conditionalExpression(children: ConditionalExpressionCstChildren, param?: IN): OUT;
  binaryExpression(children: BinaryExpressionCstChildren, param?: IN): OUT;
  unaryExpression(children: UnaryExpressionCstChildren, param?: IN): OUT;
  diceWithModifiers(children: DiceWithModifiersCstChildren, param?: IN): OUT;
  diceExpression(children: DiceExpressionCstChildren, param?: IN): OUT;
  diceTail(children: DiceTailCstChildren, param?: IN): OUT;
  atom(children: AtomCstChildren, param?: IN): OUT;
  listExpression(children: ListExpressionCstChildren, param?: IN): OUT;
  regularFunctionCall(children: RegularFunctionCallCstChildren, param?: IN): OUT;
  filterCall(children: FilterCallCstChildren, param?: IN): OUT;
  repeatForm(children: RepeatFormCstChildren, param?: IN): OUT;
  critForm(children: CritFormCstChildren, param?: IN): OUT;
  modifier(children: ModifierCstChildren, param?: IN): OUT;
  keepDropModifier(children: KeepDropModifierCstChildren, param?: IN): OUT;
  minMaxModifier(children: MinMaxModifierCstChildren, param?: IN): OUT;
  rerollModifier(children: RerollModifierCstChildren, param?: IN): OUT;
  explodeModifier(children: ExplodeModifierCstChildren, param?: IN): OUT;
  successFailureModifier(children: SuccessFailureModifierCstChildren, param?: IN): OUT;
  modParam(children: ModParamCstChildren, param?: IN): OUT;
  limit(children: LimitCstChildren, param?: IN): OUT;
}
