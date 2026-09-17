import { assertNever } from "../../utils.js"
import { numberMultiplyNumber } from "../operations/number.js"
import type {
  BooleanBinaryType,
  BooleanCompareType,
  BooleanMembershipType,
  BooleanType,
  DicePoolType,
  HIRNode,
  LimitType,
  ListBinaryType,
  ListFunctionType,
  ListType,
  ModParamType,
  NumberBinaryType,
  NumberFunctionType,
  NumberType,
  StringSetBinaryType,
  StringSetType,
  StringType,
  SuccessPoolType,
} from "../types.js"

function rewriteModParam(value: ModParamType): ModParamType {
  return { ...value, value: rewriteNumber(value.value) }
}

function rewriteLimit(value: LimitType): LimitType {
  return {
    timeLimit: value.timeLimit ? rewriteNumber(value.timeLimit) : undefined,
    countLimit: value.countLimit ? rewriteNumber(value.countLimit) : undefined,
  }
}

function rewriteDicePool(value: DicePoolType): DicePoolType {
  switch (value.kind) {
    case "standard":
      return {
        kind: "standard",
        count: numberMultiplyNumber({ kind: "constant", value: 2 }, rewriteNumber(value.count)),
        sides: rewriteNumber(value.sides),
      }
    case "fudge":
      return {
        kind: "fudge",
        count: numberMultiplyNumber({ kind: "constant", value: 2 }, rewriteNumber(value.count)),
      }
    case "coin":
      return {
        kind: "coin",
        count: numberMultiplyNumber({ kind: "constant", value: 2 }, rewriteNumber(value.count)),
      }
    case "keepHigh":
      return {
        kind: "keepHigh",
        pool: rewriteDicePool(value.pool),
        count: rewriteNumber(value.count),
      }
    case "keepLow":
      return {
        kind: "keepLow",
        pool: rewriteDicePool(value.pool),
        count: rewriteNumber(value.count),
      }
    case "dropHigh":
      return {
        kind: "dropHigh",
        pool: rewriteDicePool(value.pool),
        count: rewriteNumber(value.count),
      }
    case "dropLow":
      return {
        kind: "dropLow",
        pool: rewriteDicePool(value.pool),
        count: rewriteNumber(value.count),
      }
    case "min":
      return {
        kind: "min",
        pool: rewriteDicePool(value.pool),
        value: rewriteNumber(value.value),
      }
    case "max":
      return {
        kind: "max",
        pool: rewriteDicePool(value.pool),
        value: rewriteNumber(value.value),
      }
    case "explode":
      return {
        kind: "explode",
        pool: rewriteDicePool(value.pool),
        modParam: value.modParam ? rewriteModParam(value.modParam) : undefined,
        limit: value.limit ? rewriteLimit(value.limit) : undefined,
      }
    case "reroll":
      return {
        kind: "reroll",
        pool: rewriteDicePool(value.pool),
        modParam: rewriteModParam(value.modParam),
        limit: value.limit ? rewriteLimit(value.limit) : undefined,
      }
    case "subtractFailures":
      return {
        kind: "subtractFailures",
        pool: rewriteDicePool(value.pool),
        modParam: rewriteModParam(value.modParam),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteSuccessPool(value: SuccessPoolType): SuccessPoolType {
  switch (value.kind) {
    case "countSuccessesFromDicePool":
      return {
        kind: "countSuccessesFromDicePool",
        pool: rewriteDicePool(value.pool),
        modParam: rewriteModParam(value.modParam),
      }
    case "cancelFailuresFromDicePool":
      return {
        kind: "cancelFailuresFromDicePool",
        pool: rewriteDicePool(value.pool),
        modParam: rewriteModParam(value.modParam),
      }
    case "countSuccesses":
      return {
        kind: "countSuccesses",
        pool: rewriteSuccessPool(value.pool),
        modParam: rewriteModParam(value.modParam),
      }
    case "cancelFailures":
      return {
        kind: "cancelFailures",
        pool: rewriteSuccessPool(value.pool),
        modParam: rewriteModParam(value.modParam),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteNumberBinary(value: NumberBinaryType): NumberBinaryType {
  switch (value.kind) {
    case "add":
      return {
        kind: "add",
        constant: value.constant,
        positive: value.positive.map(rewriteNumber),
        negative: value.negative.map(rewriteNumber),
      }
    case "multiply":
      return {
        kind: "multiply",
        constant: value.constant,
        factors: value.factors.map(rewriteNumber),
      }
    case "divide":
      return {
        kind: "divide",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "intDivide":
      return {
        kind: "intDivide",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "modulo":
      return {
        kind: "modulo",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteNumberFunction(value: NumberFunctionType): NumberFunctionType {
  switch (value.kind) {
    case "floor":
      return { kind: "floor", value: rewriteNumber(value.value) }
    case "ceil":
      return { kind: "ceil", value: rewriteNumber(value.value) }
    case "round":
      return { kind: "round", value: rewriteNumber(value.value) }
    case "abs":
      return { kind: "abs", value: rewriteNumber(value.value) }
    case "fmax":
      return { kind: "fmax", value: rewriteList(value.value) }
    case "fmin":
      return { kind: "fmin", value: rewriteList(value.value) }
    case "sum":
      return { kind: "sum", value: rewriteList(value.value) }
    case "avg":
      return { kind: "avg", value: rewriteList(value.value) }
    case "len":
      return { kind: "len", value: rewriteList(value.value) }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteNumber(value: NumberType): NumberType {
  switch (value.kind) {
    case "constant":
      return value
    case "dicePool":
      return { kind: "dicePool", value: rewriteDicePool(value.value) }
    case "successPool":
      return { kind: "successPool", value: rewriteSuccessPool(value.value) }
    case "binary":
      return { kind: "binary", value: rewriteNumberBinary(value.value) }
    case "function":
      return { kind: "function", value: rewriteNumberFunction(value.value) }
    case "ternary":
      return {
        kind: "ternary",
        condition: rewriteBoolean(value.condition),
        trueValue: rewriteNumber(value.trueValue),
        falseValue: rewriteNumber(value.falseValue),
      }
    case "negative":
      return { kind: "negative", value: rewriteNumber(value.value) }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteListBinary(value: ListBinaryType): ListBinaryType {
  switch (value.kind) {
    case "concat":
      return {
        kind: "concat",
        lhs: rewriteList(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "add":
      return {
        kind: "add",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "addReverse":
      return {
        kind: "addReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "multiply":
      return {
        kind: "multiply",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "multiplyReverse":
      return {
        kind: "multiplyReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "subtract":
      return {
        kind: "subtract",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "subtractReverse":
      return {
        kind: "subtractReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "divide":
      return {
        kind: "divide",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "divideReverse":
      return {
        kind: "divideReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "intDivide":
      return {
        kind: "intDivide",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "intDivideReverse":
      return {
        kind: "intDivideReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    case "modulo":
      return {
        kind: "modulo",
        lhs: rewriteList(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "moduloReverse":
      return {
        kind: "moduloReverse",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteList(value.rhs),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteListFunction(value: ListFunctionType): ListFunctionType {
  switch (value.kind) {
    case "floor":
      return { kind: "floor", value: rewriteList(value.value) }
    case "ceil":
      return { kind: "ceil", value: rewriteList(value.value) }
    case "round":
      return { kind: "round", value: rewriteList(value.value) }
    case "abs":
      return { kind: "abs", value: rewriteList(value.value) }
    case "fmax":
      return {
        kind: "fmax",
        list: rewriteList(value.list),
        count: rewriteNumber(value.count),
      }
    case "fmin":
      return {
        kind: "fmin",
        list: rewriteList(value.list),
        count: rewriteNumber(value.count),
      }
    case "sort":
      return { kind: "sort", value: rewriteList(value.value) }
    case "sortdesc":
      return { kind: "sortdesc", value: rewriteList(value.value) }
    case "tolistFromDice":
      return { kind: "tolistFromDice", value: rewriteDicePool(value.value) }
    case "tolistFromSuccess":
      return { kind: "tolistFromSuccess", value: rewriteSuccessPool(value.value) }
    case "filter":
      return {
        kind: "filter",
        list: rewriteList(value.list),
        modParam: rewriteModParam(value.modParam),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteList(value: ListType): ListType {
  switch (value.kind) {
    case "explicit":
      return { kind: "explicit", value: value.value.map(rewriteNumber) }
    case "function":
      return { kind: "function", value: rewriteListFunction(value.value) }
    case "binary":
      return { kind: "binary", value: rewriteListBinary(value.value) }
    case "ternary":
      return {
        kind: "ternary",
        condition: rewriteBoolean(value.condition),
        trueValue: rewriteList(value.trueValue),
        falseValue: rewriteList(value.falseValue),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteBooleanCompare(value: BooleanCompareType): BooleanCompareType {
  switch (value.kind) {
    case "equal":
      return {
        kind: "equal",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "notEqual":
      return {
        kind: "notEqual",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "greaterThan":
      return {
        kind: "greaterThan",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "greaterThanOrEqual":
      return {
        kind: "greaterThanOrEqual",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "lessThan":
      return {
        kind: "lessThan",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    case "lessThanOrEqual":
      return {
        kind: "lessThanOrEqual",
        lhs: rewriteNumber(value.lhs),
        rhs: rewriteNumber(value.rhs),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteBooleanBinary(value: BooleanBinaryType): BooleanBinaryType {
  switch (value.kind) {
    case "and":
      return {
        kind: "and",
        lhs: rewriteBoolean(value.lhs),
        rhs: rewriteBoolean(value.rhs),
      }
    case "or":
      return {
        kind: "or",
        lhs: rewriteBoolean(value.lhs),
        rhs: rewriteBoolean(value.rhs),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteBooleanMembership(value: BooleanMembershipType): BooleanMembershipType {
  return {
    lhs: rewriteString(value.lhs),
    rhs: rewriteStringSet(value.rhs),
  }
}

function rewriteBoolean(value: BooleanType): BooleanType {
  switch (value.kind) {
    case "constant":
      return value
    case "compare":
      return { kind: "compare", value: rewriteBooleanCompare(value.value) }
    case "membership":
      return { kind: "membership", value: rewriteBooleanMembership(value.value) }
    case "binary":
      return { kind: "binary", value: rewriteBooleanBinary(value.value) }
    case "ternary":
      return {
        kind: "ternary",
        condition: rewriteBoolean(value.condition),
        trueValue: rewriteBoolean(value.trueValue),
        falseValue: rewriteBoolean(value.falseValue),
      }
    case "not":
      return { kind: "not", value: rewriteBoolean(value.value) }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteString(value: StringType): StringType {
  switch (value.kind) {
    case "constant":
      return value
    case "ternary":
      return {
        kind: "ternary",
        condition: rewriteBoolean(value.condition),
        trueValue: rewriteString(value.trueValue),
        falseValue: rewriteString(value.falseValue),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function rewriteStringSetBinary(value: StringSetBinaryType): StringSetBinaryType {
  return {
    kind: value.kind,
    lhs: rewriteStringSet(value.lhs),
    rhs: rewriteStringSet(value.rhs),
  }
}

function rewriteStringSet(value: StringSetType): StringSetType {
  switch (value.kind) {
    case "explicit":
      return { kind: "explicit", value: value.value.map(rewriteString) }
    case "binary":
      return { kind: "binary", value: rewriteStringSetBinary(value.value) }
    case "ternary":
      return {
        kind: "ternary",
        condition: rewriteBoolean(value.condition),
        trueValue: rewriteStringSet(value.trueValue),
        falseValue: rewriteStringSet(value.falseValue),
      }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

export function rewriteHirForCrit(value: HIRNode): HIRNode {
  switch (value.kind) {
    case "number":
      return { kind: "number", value: rewriteNumber(value.value) }
    case "list":
      return { kind: "list", value: rewriteList(value.value) }
    case "boolean":
      return { kind: "boolean", value: rewriteBoolean(value.value) }
    case "string":
      return { kind: "string", value: rewriteString(value.value) }
    case "stringSet":
      return { kind: "stringSet", value: rewriteStringSet(value.value) }
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}
