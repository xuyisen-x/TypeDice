import type { StringType } from "../../hir/types.js"
import { assertNever, PRECEDENCE } from "../../utils.js"
import type { EvaluationEnvironment, NodeLayout, OutputNode } from "../types.js"
import { booleanValue, evaluated, requireEvaluated, reserveNodeID, shortCircuited, withRollBarrier } from "../utils.js"
import { visitBoolean } from "./boolean.js"

export function visitString(env: EvaluationEnvironment, value: StringType, active: boolean): OutputNode {
  switch (value.kind) {
    case "constant": {
      const layout: NodeLayout = { kind: "atom", text: JSON.stringify(value.value) }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)
      return evaluated(reserveNodeID(env), layout, PRECEDENCE.atom, { kind: "string", value: value.value }, 0)
    }
    case "ternary":
      return visitStringTernary(env, value, active)
    /* v8 ignore next -- @preserve */
    default:
      return assertNever(value)
  }
}

function visitStringTernary(
  env: EvaluationEnvironment,
  value: Extract<StringType, { kind: "ternary" }>,
  active: boolean
): OutputNode {
  const condition = visitBoolean(env, value.condition, active)
  const takeTrueBranch = active && booleanValue(condition)
  const conditionRound = active ? requireEvaluated(condition).readyRound : 0
  const trueBranch = takeTrueBranch
    ? withRollBarrier(env, conditionRound, () => visitString(env, value.trueValue, true))
    : visitString(env, value.trueValue, false)
  const falseBranch =
    active && !takeTrueBranch
      ? withRollBarrier(env, conditionRound, () => visitString(env, value.falseValue, true))
      : visitString(env, value.falseValue, false)

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
