export type HirEnv = { resolveNamedExpression: (name: string) => HIRNode | undefined }

export type ModParamType =
  | { kind: "equal"; value: NumberType }
  | { kind: "notEqual"; value: NumberType }
  | { kind: "greaterThan"; value: NumberType }
  | { kind: "greaterThanOrEqual"; value: NumberType }
  | { kind: "lessThan"; value: NumberType }
  | { kind: "lessThanOrEqual"; value: NumberType }

export type LimitType = { timeLimit?: NumberType; countLimit?: NumberType }

export type HIRNode =
  | { kind: "number"; value: NumberType }
  | { kind: "list"; value: ListType }
  | { kind: "boolean"; value: BooleanType }

export type NumberType =
  | { kind: "constant"; value: number }
  | { kind: "dicePool"; value: DicePoolType }
  | { kind: "successPool"; value: SuccessPoolType }
  | { kind: "binary"; value: NumberBinaryType }
  | { kind: "function"; value: NumberFunctionType }
  | { kind: "ternary"; condition: BooleanType; trueValue: NumberType; falseValue: NumberType }
  | { kind: "negative"; value: NumberType }

export type DicePoolType =
  | { kind: "standard"; count: NumberType; sides: NumberType }
  | { kind: "fudge"; count: NumberType }
  | { kind: "coin"; count: NumberType }
  | { kind: "keepHigh"; pool: DicePoolType; count: NumberType }
  | { kind: "keepLow"; pool: DicePoolType; count: NumberType }
  | { kind: "dropHigh"; pool: DicePoolType; count: NumberType }
  | { kind: "dropLow"; pool: DicePoolType; count: NumberType }
  | { kind: "min"; pool: DicePoolType; value: NumberType }
  | { kind: "max"; pool: DicePoolType; value: NumberType }
  | { kind: "explode"; pool: DicePoolType; modParam?: ModParamType; limit?: LimitType }
  | { kind: "reroll"; pool: DicePoolType; modParam: ModParamType; limit?: LimitType }
  | { kind: "subtractFailures"; pool: DicePoolType; modParam: ModParamType }

export type SuccessPoolType =
  | { kind: "countSuccessesFromDicePool"; pool: DicePoolType; modParam: ModParamType }
  | { kind: "cancelFailuresFromDicePool"; pool: DicePoolType; modParam: ModParamType }
  | { kind: "countSuccesses"; pool: SuccessPoolType; modParam: ModParamType }
  | { kind: "cancelFailures"; pool: SuccessPoolType; modParam: ModParamType }

export type NumberBinaryType =
  | { kind: "add"; constant: number; positive: NumberType[]; negative: NumberType[] }
  | { kind: "multiply"; constant: number; factors: NumberType[] }
  | { kind: "divide"; lhs: NumberType; rhs: NumberType }
  | { kind: "intDivide"; lhs: NumberType; rhs: NumberType }
  | { kind: "modulo"; lhs: NumberType; rhs: NumberType }

export type NumberFunctionType =
  | { kind: "floor"; value: NumberType }
  | { kind: "ceil"; value: NumberType }
  | { kind: "round"; value: NumberType }
  | { kind: "abs"; value: NumberType }
  | { kind: "fmax"; value: ListType }
  | { kind: "fmin"; value: ListType }
  | { kind: "sum"; value: ListType }
  | { kind: "avg"; value: ListType }
  | { kind: "len"; value: ListType }

export type ListType =
  | { kind: "explicit"; value: NumberType[] }
  | { kind: "function"; value: ListFunctionType }
  | { kind: "binary"; value: ListBinaryType }
  | { kind: "ternary"; condition: BooleanType; trueValue: ListType; falseValue: ListType }

export type ListBinaryType =
  | { kind: "concat"; lhs: ListType; rhs: ListType }
  | { kind: "add"; lhs: ListType; rhs: NumberType }
  | { kind: "addReverse"; lhs: NumberType; rhs: ListType }
  | { kind: "multiply"; lhs: ListType; rhs: NumberType }
  | { kind: "multiplyReverse"; lhs: NumberType; rhs: ListType }
  | { kind: "subtract"; lhs: ListType; rhs: NumberType }
  | { kind: "subtractReverse"; lhs: NumberType; rhs: ListType }
  | { kind: "divide"; lhs: ListType; rhs: NumberType }
  | { kind: "divideReverse"; lhs: NumberType; rhs: ListType }
  | { kind: "intDivide"; lhs: ListType; rhs: NumberType }
  | { kind: "intDivideReverse"; lhs: NumberType; rhs: ListType }
  | { kind: "modulo"; lhs: ListType; rhs: NumberType }
  | { kind: "moduloReverse"; lhs: NumberType; rhs: ListType }

export type ListFunctionType =
  | { kind: "floor"; value: ListType }
  | { kind: "ceil"; value: ListType }
  | { kind: "round"; value: ListType }
  | { kind: "abs"; value: ListType }
  | { kind: "fmax"; list: ListType; count: NumberType }
  | { kind: "fmin"; list: ListType; count: NumberType }
  | { kind: "sort"; value: ListType }
  | { kind: "sortdesc"; value: ListType }
  | { kind: "tolistFromDice"; value: DicePoolType }
  | { kind: "tolistFromSuccess"; value: SuccessPoolType }
  | { kind: "filter"; list: ListType; modParam: ModParamType }

export type BooleanType =
  | { kind: "constant"; value: boolean }
  | { kind: "compare"; value: BooleanCompareType }
  | { kind: "binary"; value: BooleanBinaryType }
  | { kind: "ternary"; condition: BooleanType; trueValue: BooleanType; falseValue: BooleanType }
  | { kind: "not"; value: BooleanType }

export type BooleanCompareType =
  | { kind: "equal"; lhs: NumberType; rhs: NumberType }
  | { kind: "notEqual"; lhs: NumberType; rhs: NumberType }
  | { kind: "greaterThan"; lhs: NumberType; rhs: NumberType }
  | { kind: "greaterThanOrEqual"; lhs: NumberType; rhs: NumberType }
  | { kind: "lessThan"; lhs: NumberType; rhs: NumberType }
  | { kind: "lessThanOrEqual"; lhs: NumberType; rhs: NumberType }

export type BooleanBinaryType =
  | { kind: "and"; lhs: BooleanType; rhs: BooleanType }
  | { kind: "or"; lhs: BooleanType; rhs: BooleanType }
