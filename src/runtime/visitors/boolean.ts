import type { BooleanBinaryType, BooleanCompareType, BooleanMembershipType, BooleanType } from "../../hir/types.js"
import { assertNever, PRECEDENCE } from "../../utils.js"
import { visitNumber } from "./number.js"
import type { EvaluationEnvironment, NodeLayout, OutputNode } from "../types.js"
import {
  booleanValue,
  comparatorText,
  compare,
  evaluated,
  maxReadyRound,
  numberValue,
  requireEvaluated,
  reserveNodeID,
  setLeftOperandParentheses,
  setRightOperandParentheses,
  shortCircuited,
  stringSetValue,
  stringValue,
  withRollBarrier,
} from "../utils.js"
import { visitStringSet } from "./string-set.js"
import { visitString } from "./string.js"

export function visitBoolean(env: EvaluationEnvironment, value: BooleanType, active: boolean): OutputNode {
  switch (value.kind) {
    case "constant": {
      const layout: NodeLayout = { kind: "atom", text: value.value ? "true" : "false" }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)
      return evaluated(reserveNodeID(env), layout, PRECEDENCE.atom, { kind: "boolean", value: value.value }, 0)
    }
    case "compare":
      return visitBooleanCompare(env, value.value, active)
    case "membership":
      return visitBooleanMembership(env, value.value, active)
    case "binary":
      return visitBooleanBinary(env, value.value, active)
    case "ternary":
      return visitBooleanTernary(env, value, active)
    case "not":
      return visitBooleanNot(env, value.value, active)
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function visitBooleanMembership(env: EvaluationEnvironment, value: BooleanMembershipType, active: boolean): OutputNode {
  const lhs = visitString(env, value.lhs, active)
  const rhs = visitStringSet(env, value.rhs, active)

  setLeftOperandParentheses(lhs, PRECEDENCE.membership)
  setRightOperandParentheses(rhs, PRECEDENCE.membership)
  const layout: NodeLayout = { kind: "binary", operators: ["in"], operands: [lhs, rhs] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.membership)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.membership,
    { kind: "boolean", value: stringSetValue(rhs).has(stringValue(lhs)) },
    maxReadyRound([lhs, rhs])
  )
}

function visitBooleanCompare(env: EvaluationEnvironment, value: BooleanCompareType, active: boolean): OutputNode {
  const lhs = visitNumber(env, value.lhs, active)
  const rhs = visitNumber(env, value.rhs, active)

  setLeftOperandParentheses(lhs, PRECEDENCE.compare)
  setRightOperandParentheses(rhs, PRECEDENCE.compare)

  const operator = comparatorText(value.kind)
  const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.compare)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.compare,
    { kind: "boolean", value: compare(value.kind, numberValue(lhs), numberValue(rhs)) },
    maxReadyRound([lhs, rhs])
  )
}

function visitBooleanBinary(env: EvaluationEnvironment, value: BooleanBinaryType, active: boolean): OutputNode {
  const lhs = visitBoolean(env, value.lhs, active)
  const lhsValue = active ? booleanValue(lhs) : false
  const evaluateRhs = active && (value.kind === "and" ? lhsValue : !lhsValue)
  const rhs = evaluateRhs
    ? withRollBarrier(env, requireEvaluated(lhs).readyRound, () => {
        return visitBoolean(env, value.rhs, true)
      })
    : visitBoolean(env, value.rhs, false)

  const precedence = value.kind === "and" ? PRECEDENCE.and : PRECEDENCE.or
  setLeftOperandParentheses(lhs, precedence)
  setRightOperandParentheses(rhs, precedence)

  const operator = value.kind === "and" ? "&&" : "||"
  const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, precedence)

  const result = evaluateRhs ? booleanValue(rhs) : lhsValue
  return evaluated(
    reserveNodeID(env),
    layout,
    precedence,
    { kind: "boolean", value: result },
    maxReadyRound([lhs, rhs])
  )
}

function visitBooleanTernary(
  env: EvaluationEnvironment,
  value: Extract<BooleanType, { kind: "ternary" }>,
  active: boolean
): OutputNode {
  const condition = visitBoolean(env, value.condition, active)
  const takeTrueBranch = active && booleanValue(condition) // if active is false, condition is not evaluated
  const conditionRound = active ? requireEvaluated(condition).readyRound : 0
  const trueBranch = takeTrueBranch
    ? withRollBarrier(env, conditionRound, () => visitBoolean(env, value.trueValue, true))
    : visitBoolean(env, value.trueValue, false)
  const falseBranch =
    active && !takeTrueBranch
      ? withRollBarrier(env, conditionRound, () => visitBoolean(env, value.falseValue, true))
      : visitBoolean(env, value.falseValue, false)

  if (condition.precedence <= PRECEDENCE.ternary) condition.parenthesized = true
  if (trueBranch.precedence === PRECEDENCE.ternary) trueBranch.parenthesized = true
  const layout: NodeLayout = { kind: "ternary", condition, trueBranch, falseBranch }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.ternary)

  // Exactly one of the branches is evaluated, since active is true.
  const chosen = requireEvaluated(takeTrueBranch ? trueBranch : falseBranch)
  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.ternary,
    chosen.value,
    Math.max(requireEvaluated(condition).readyRound, chosen.readyRound)
  )
}

function visitBooleanNot(env: EvaluationEnvironment, value: BooleanType, active: boolean): OutputNode {
  const operand = visitBoolean(env, value, active)

  /* v8 ignore else -- @preserve */
  if (operand.precedence <= PRECEDENCE.unary) operand.parenthesized = true
  const layout: NodeLayout = { kind: "unary", operator: "!", operand }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.unary)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.unary,
    { kind: "boolean", value: !booleanValue(operand) },
    maxReadyRound([operand])
  )
}
