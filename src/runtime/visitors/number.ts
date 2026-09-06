import type { NumberBinaryType, NumberFunctionType, NumberType } from "../../hir/types.js"
import { assertNever, formatFiniteNumber, PRECEDENCE } from "../../utils.js"
import { visitBoolean } from "./boolean.js"
import { visitList } from "./list.js"
import type { EvaluationEnvironment, NodeLayout, OutputNode } from "./../types.js"
import {
  booleanValue,
  evaluated,
  listValue,
  maxReadyRound,
  numberValue,
  prepareBinaryOperands,
  requireEvaluated,
  reserveNodeID,
  setLeftOperandParentheses,
  setRightOperandParentheses,
  shortCircuited,
  withRollBarrier,
} from "./../utils.js"
import { visitDicePool, visitSuccessPool } from "./dice.js"
import { RuntimeException } from "../errors.js"

export function visitNumber(env: EvaluationEnvironment, value: NumberType, active: boolean): OutputNode {
  switch (value.kind) {
    case "constant":
      return visitAtomNumber(env, value.value, active)
    case "dicePool":
      return visitDicePool(env, value.value, active)
    case "successPool":
      return visitSuccessPool(env, value.value, active)
    case "binary":
      return visitNumberBinary(env, value.value, active)
    case "function":
      return visitNumberFunction(env, value.value, active)
    case "ternary":
      return visitNumberTernary(env, value, active)
    case "negative":
      return visitSyntheticNegative(env, value.value, active)
    default:
      return assertNever(value)
  }
}

function visitAtomNumber(env: EvaluationEnvironment, value: number, active: boolean): OutputNode {
  const [text, precedence] = (() => {
    if (Number.isNaN(value)) return ["NaN", PRECEDENCE.atom]
    if (value === Number.POSITIVE_INFINITY) return ["Inf", PRECEDENCE.atom]
    if (value === Number.NEGATIVE_INFINITY) return ["-Inf", PRECEDENCE.unary]
    const text = formatFiniteNumber(value)
    if (text.startsWith("-")) return [text, PRECEDENCE.unary]
    return [text, PRECEDENCE.atom]
  })()

  const layout: NodeLayout = { kind: "atom", text }
  if (!active) return shortCircuited(reserveNodeID(env), layout, precedence)

  return evaluated(reserveNodeID(env), layout, precedence, { kind: "number", value }, 0)
}

function visitSyntheticNegative(env: EvaluationEnvironment, value: NumberType, active: boolean): OutputNode {
  const operand = visitNumber(env, value, active)
  if (operand.precedence <= PRECEDENCE.unary) operand.parenthesized = true
  const layout: NodeLayout = { kind: "unary", operator: "-", operand }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.unary)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.unary,
    { kind: "number", value: -numberValue(operand) },
    maxReadyRound([operand])
  )
}

function visitNumberBinary(env: EvaluationEnvironment, value: NumberBinaryType, active: boolean): OutputNode {
  switch (value.kind) {
    case "add":
      return visitNumberAdd(env, value, active)
    case "multiply":
      return visitNumberMultiply(env, value, active)
    case "divide":
      return visitNumberPairBinary(env, value.lhs, "/", value.rhs, active, (lhs, rhs) => lhs / rhs)
    case "intDivide":
      return visitNumberPairBinary(env, value.lhs, "//", value.rhs, active, (lhs, rhs) => Math.floor(lhs / rhs))
    case "modulo":
      return visitNumberPairBinary(env, value.lhs, "%", value.rhs, active, (lhs, rhs) => lhs % rhs)
    default:
      return assertNever(value)
  }
}

function visitNumberAdd(
  env: EvaluationEnvironment,
  value: Extract<NumberBinaryType, { kind: "add" }>,
  active: boolean
): OutputNode {
  const operands: OutputNode[] = []
  const operators: string[] = []
  let result = value.constant

  for (const item of value.positive) {
    const operand = visitNumber(env, item, active)
    if (operands.length > 0) operators.push("+")
    operands.push(operand)
    if (active) result += numberValue(operand)
  }

  for (const item of value.negative) {
    if (operands.length === 0) {
      const operand = visitSyntheticNegative(env, item, active)
      operands.push(operand)
      if (active) result += numberValue(operand)
    } else {
      const operand = visitNumber(env, item, active)
      operators.push("-")
      operands.push(operand)
      if (active) result -= numberValue(operand)
    }
  }

  if (value.constant !== 0 || operands.length === 0) {
    if (operands.length === 0) {
      operands.push(visitAtomNumber(env, value.constant, active))
    } else if (value.constant < 0) {
      operators.push("-")
      operands.push(visitAtomNumber(env, -value.constant, active))
    } else {
      operators.push("+")
      operands.push(visitAtomNumber(env, value.constant, active))
    }
  }

  prepareBinaryOperands(operands, PRECEDENCE.additive)
  const layout: NodeLayout = { kind: "binary", operators, operands }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.additive)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.additive,
    { kind: "number", value: result },
    maxReadyRound(operands)
  )
}

function visitNumberMultiply(
  env: EvaluationEnvironment,
  value: Extract<NumberBinaryType, { kind: "multiply" }>,
  active: boolean
): OutputNode {
  const operands: OutputNode[] = []
  if (value.constant !== 1 || value.factors.length === 0) {
    operands.push(visitAtomNumber(env, value.constant, active))
  }
  operands.push(...value.factors.map((factor) => visitNumber(env, factor, active)))
  prepareBinaryOperands(operands, PRECEDENCE.multiplicative)

  const layout: NodeLayout = {
    kind: "binary",
    operators: operands.slice(1).map(() => "*"),
    operands,
  }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.multiplicative)

  const result = operands.reduce((product, operand) => product * numberValue(operand), 1)
  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.multiplicative,
    { kind: "number", value: result },
    maxReadyRound(operands)
  )
}

function visitNumberPairBinary(
  env: EvaluationEnvironment,
  lhsValue: NumberType,
  operator: string,
  rhsValue: NumberType,
  active: boolean,
  operation: (lhs: number, rhs: number) => number
): OutputNode {
  const lhs = visitNumber(env, lhsValue, active)
  const rhs = visitNumber(env, rhsValue, active)

  setLeftOperandParentheses(lhs, PRECEDENCE.multiplicative)
  setRightOperandParentheses(rhs, PRECEDENCE.multiplicative)

  const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.multiplicative)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.multiplicative,
    { kind: "number", value: operation(numberValue(lhs), numberValue(rhs)) },
    maxReadyRound([lhs, rhs])
  )
}

function visitNumberFunction(env: EvaluationEnvironment, value: NumberFunctionType, active: boolean): OutputNode {
  switch (value.kind) {
    case "floor":
      return visitUnaryNumberFunction(env, "floor", value.value, active, Math.floor)
    case "ceil":
      return visitUnaryNumberFunction(env, "ceil", value.value, active, Math.ceil)
    case "round":
      return visitUnaryNumberFunction(env, "round", value.value, active, Math.round)
    case "abs":
      return visitUnaryNumberFunction(env, "abs", value.value, active, Math.abs)
    case "fmax":
    case "fmin":
    case "sum":
    case "avg":
    case "len": {
      const argument = visitList(env, value.value, active)
      const layout: NodeLayout = { kind: "function", name: value.kind, args: [argument] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      const list = listValue(argument)
      let result: number
      if (value.kind === "fmax") {
        if (list.length === 0) throw new RuntimeException("函数fmax不能用于空列表")
        result = list.reduce((current, item) => Math.max(current, item), list[0])
      } else if (value.kind === "fmin") {
        if (list.length === 0) throw new RuntimeException("函数fmin不能用于空列表")
        result = list.reduce((current, item) => Math.min(current, item), list[0])
      } else if (value.kind === "sum") {
        result = list.reduce((sum, item) => sum + item, 0)
      } else if (value.kind === "avg") {
        result = list.length === 0 ? 0 : list.reduce((sum, item) => sum + item, 0) / list.length
      } else {
        result = list.length
      }
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "number", value: result },
        maxReadyRound([argument])
      )
    }
    default:
      return assertNever(value)
  }
}

function visitUnaryNumberFunction(
  env: EvaluationEnvironment,
  name: string,
  value: NumberType,
  active: boolean,
  operation: (value: number) => number
): OutputNode {
  const argument = visitNumber(env, value, active)
  const layout: NodeLayout = { kind: "function", name, args: [argument] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.atom,
    { kind: "number", value: operation(numberValue(argument)) },
    maxReadyRound([argument])
  )
}

function visitNumberTernary(
  env: EvaluationEnvironment,
  value: Extract<NumberType, { kind: "ternary" }>,
  active: boolean
): OutputNode {
  const condition = visitBoolean(env, value.condition, active)
  const takeTrueBranch = active && booleanValue(condition)
  const conditionRound = active ? requireEvaluated(condition).readyRound : 0
  const trueBranch = takeTrueBranch
    ? withRollBarrier(env, conditionRound, () => visitNumber(env, value.trueValue, true))
    : visitNumber(env, value.trueValue, false)
  const falseBranch =
    active && !takeTrueBranch
      ? withRollBarrier(env, conditionRound, () => visitNumber(env, value.falseValue, true))
      : visitNumber(env, value.falseValue, false)

  if (condition.precedence <= PRECEDENCE.ternary) condition.parenthesized = true
  if (trueBranch.precedence === PRECEDENCE.ternary) trueBranch.parenthesized = true

  const layout: NodeLayout = { kind: "ternary", condition, trueBranch, falseBranch }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.ternary)

  const chosen = requireEvaluated(takeTrueBranch ? trueBranch : falseBranch)
  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.ternary,
    chosen.value,
    Math.max(requireEvaluated(condition).readyRound, chosen.readyRound)
  )
}
