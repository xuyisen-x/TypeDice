import type { StringSetBinaryType, StringSetType } from "../../hir/types.js"
import { assertNever, PRECEDENCE } from "../../utils.js"
import type { EvaluationEnvironment, NodeLayout, OutputNode } from "../types.js"
import {
  booleanValue,
  evaluated,
  maxReadyRound,
  requireEvaluated,
  reserveNodeID,
  setLeftOperandParentheses,
  setRightOperandParentheses,
  shortCircuited,
  stringSetValue,
  withRollBarrier,
} from "../utils.js"
import { visitBoolean } from "./boolean.js"
import { visitString } from "./string.js"

export function visitStringSet(env: EvaluationEnvironment, value: StringSetType, active: boolean): OutputNode {
  switch (value.kind) {
    case "explicit":
      return visitExplicitStringSet(env, value, active)
    case "binary":
      return visitStringSetBinary(env, value.value, active)
    case "ternary":
      return visitStringSetTernary(env, value, active)
    default:
      return assertNever(value)
  }
}

function visitStringSetBinary(env: EvaluationEnvironment, value: StringSetBinaryType, active: boolean): OutputNode {
  const lhs = visitStringSet(env, value.lhs, active)
  const rhs = visitStringSet(env, value.rhs, active)
  const { operator, precedence } = (() => {
    switch (value.kind) {
      case "difference":
        return { operator: "-", precedence: PRECEDENCE.additive }
      case "intersection":
        return { operator: "&", precedence: PRECEDENCE.setIntersection }
      case "symmetricDifference":
        return { operator: "^", precedence: PRECEDENCE.setSymmetricDifference }
      case "union":
        return { operator: "|", precedence: PRECEDENCE.setUnion }
      default:
        return assertNever(value)
    }
  })()

  setLeftOperandParentheses(lhs, precedence)
  setRightOperandParentheses(rhs, precedence)
  const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, precedence)

  const lhsSet = stringSetValue(lhs)
  const rhsSet = stringSetValue(rhs)
  let result: Set<string>
  switch (value.kind) {
    case "difference":
      result = new Set([...lhsSet].filter((item) => !rhsSet.has(item)))
      break
    case "intersection":
      result = new Set([...lhsSet].filter((item) => rhsSet.has(item)))
      break
    case "symmetricDifference":
      result = new Set([
        ...[...lhsSet].filter((item) => !rhsSet.has(item)),
        ...[...rhsSet].filter((item) => !lhsSet.has(item)),
      ])
      break
    case "union":
      result = new Set([...lhsSet, ...rhsSet])
      break
    default:
      return assertNever(value)
  }

  return evaluated(
    reserveNodeID(env),
    layout,
    precedence,
    { kind: "stringSet", value: result },
    maxReadyRound([lhs, rhs])
  )
}

function visitExplicitStringSet(
  env: EvaluationEnvironment,
  value: Extract<StringSetType, { kind: "explicit" }>,
  active: boolean
): OutputNode {
  const children = value.value.map((item) => visitString(env, item, active))
  const layout: NodeLayout = { kind: "stringSet", children }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.atom,
    {
      kind: "stringSet",
      value: new Set(
        children.map((child) => {
          const childValue = requireEvaluated(child).value
          if (childValue.kind !== "string") throw new Error("Unreachable: expected a string value")
          return childValue.value
        })
      ),
    },
    maxReadyRound(children)
  )
}

function visitStringSetTernary(
  env: EvaluationEnvironment,
  value: Extract<StringSetType, { kind: "ternary" }>,
  active: boolean
): OutputNode {
  const condition = visitBoolean(env, value.condition, active)
  const takeTrueBranch = active && booleanValue(condition)
  const conditionRound = active ? requireEvaluated(condition).readyRound : 0
  const trueBranch = takeTrueBranch
    ? withRollBarrier(env, conditionRound, () => visitStringSet(env, value.trueValue, true))
    : visitStringSet(env, value.trueValue, false)
  const falseBranch =
    active && !takeTrueBranch
      ? withRollBarrier(env, conditionRound, () => visitStringSet(env, value.falseValue, true))
      : visitStringSet(env, value.falseValue, false)

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
