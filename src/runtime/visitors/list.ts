import type { ListBinaryType, ListFunctionType, ListType } from "../../hir/types.js"
import { assertNever, normalizeNaturalNumber, PRECEDENCE } from "../../utils.js"
import { visitBoolean } from "./boolean.js"
import { visitDicePool, visitSuccessPool } from "./dice.js"
import { visitNumber } from "./number.js"
import { visitModParam } from "./special.js"
import type { EvaluationEnvironment, NodeLayout, OutputNode } from "../types.js"
import {
  booleanValue,
  dicePoolValue,
  evaluated,
  listBinaryOperator,
  listValue,
  maxReadyRound,
  numberValue,
  requireEvaluated,
  reserveNodeID,
  setLeftOperandParentheses,
  setRightOperandParentheses,
  shortCircuited,
  successPoolValue,
  withRollBarrier,
} from "../utils.js"
import { RuntimeException } from "../errors.js"

export function visitList(env: EvaluationEnvironment, value: ListType, active: boolean): OutputNode {
  switch (value.kind) {
    case "explicit":
      return visitExplicitList(env, value, active)
    case "function":
      return visitListFunction(env, value.value, active)
    case "binary":
      return visitListBinary(env, value.value, active)
    case "ternary":
      return visitListTernary(env, value, active)
    default:
      return assertNever(value)
  }
}

function visitExplicitList(
  env: EvaluationEnvironment,
  value: Extract<ListType, { kind: "explicit" }>,
  active: boolean
): OutputNode {
  const children = value.value.map((item) => visitNumber(env, item, active))

  const layout: NodeLayout = { kind: "list", children }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.atom,
    { kind: "list", value: children.map((child) => numberValue(child)) },
    maxReadyRound(children)
  )
}

function visitListFunction(env: EvaluationEnvironment, value: ListFunctionType, active: boolean): OutputNode {
  switch (value.kind) {
    case "floor":
      return visitUnaryListFunction(env, "floor", value.value, active, Math.floor)
    case "ceil":
      return visitUnaryListFunction(env, "ceil", value.value, active, Math.ceil)
    case "round":
      return visitUnaryListFunction(env, "round", value.value, active, Math.round)
    case "abs":
      return visitUnaryListFunction(env, "abs", value.value, active, Math.abs)
    case "sort":
    case "sortdesc": {
      const argument = visitList(env, value.value, active)
      const name = value.kind === "sort" ? "sort" : "sortd"
      const layout: NodeLayout = { kind: "function", name, args: [argument] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      const indexed = listValue(argument)
        .map((item, index) => ({ item, index }))
        .sort((lhs, rhs) => {
          const difference = value.kind === "sort" ? lhs.item - rhs.item : rhs.item - lhs.item
          return Number.isNaN(difference) || difference === 0 ? lhs.index - rhs.index : difference
        })
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "list", value: indexed.map(({ item }) => item) },
        maxReadyRound([argument])
      )
    }
    case "fmax":
    case "fmin": {
      const list = visitList(env, value.list, active)
      const count = visitNumber(env, value.count, active)

      const layout: NodeLayout = { kind: "function", name: value.kind, args: [list, count] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      const selected = listValue(list)
        .map((item, index) => ({ item, index }))
        .sort((lhs, rhs) => {
          const difference = value.kind === "fmax" ? rhs.item - lhs.item : lhs.item - rhs.item
          return Number.isNaN(difference) || difference === 0 ? lhs.index - rhs.index : difference
        })
        .slice(0, normalizeNaturalNumber(numberValue(count)))
        .sort((lhs, rhs) => lhs.index - rhs.index)
        .map(({ item }) => item)
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "list", value: selected },
        maxReadyRound([list, count])
      )
    }
    case "tolistFromDice": {
      const argument = visitDicePool(env, value.value, active)
      const layout: NodeLayout = { kind: "function", name: "tolist", args: [argument] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      const list = dicePoolValue(argument)
        .details.filter((detail) => detail.isKept)
        .map((detail) => detail.result)
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "list", value: list },
        maxReadyRound([argument])
      )
    }
    case "tolistFromSuccess": {
      const argument = visitSuccessPool(env, value.value, active)
      const layout: NodeLayout = { kind: "function", name: "tolist", args: [argument] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      const list = successPoolValue(argument)
        .details.filter((detail) => detail.isKept)
        .map((detail) => (detail.outcome === "success" ? 1 : detail.outcome === "failure" ? -1 : 0))
      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "list", value: list },
        maxReadyRound([argument])
      )
    }
    case "filter": {
      const list = visitList(env, value.list, active)
      const modParam = visitModParam(env, value.modParam, active)

      const layout: NodeLayout = {
        kind: "function",
        name: "filter",
        modParam: { comparator: modParam.comparator, param: modParam.param },
        args: [list],
      }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.atom,
        { kind: "list", value: listValue(list).filter(modParam.predicate) },
        Math.max(maxReadyRound([list]), modParam.readyRound)
      )
    }
    default:
      return assertNever(value)
  }
}

function visitUnaryListFunction(
  env: EvaluationEnvironment,
  name: string,
  value: ListType,
  active: boolean,
  operation: (value: number) => number
): OutputNode {
  const argument = visitList(env, value, active)
  const layout: NodeLayout = { kind: "function", name, args: [argument] }
  if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.atom)

  return evaluated(
    reserveNodeID(env),
    layout,
    PRECEDENCE.atom,
    { kind: "list", value: listValue(argument).map(operation) },
    maxReadyRound([argument])
  )
}

function visitListTernary(
  env: EvaluationEnvironment,
  value: Extract<ListType, { kind: "ternary" }>,
  active: boolean
): OutputNode {
  const condition = visitBoolean(env, value.condition, active)
  const takeTrueBranch = active && booleanValue(condition)
  const conditionRound = active ? requireEvaluated(condition).readyRound : 0
  const trueBranch = takeTrueBranch
    ? withRollBarrier(env, conditionRound, () => visitList(env, value.trueValue, true))
    : visitList(env, value.trueValue, false)
  const falseBranch =
    active && !takeTrueBranch
      ? withRollBarrier(env, conditionRound, () => visitList(env, value.falseValue, true))
      : visitList(env, value.falseValue, false)

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

function visitListBinary(env: EvaluationEnvironment, value: ListBinaryType, active: boolean): OutputNode {
  switch (value.kind) {
    case "concat": {
      const lhs = visitList(env, value.lhs, active)
      const rhs = visitList(env, value.rhs, active)

      setLeftOperandParentheses(lhs, PRECEDENCE.concat)
      setRightOperandParentheses(rhs, PRECEDENCE.concat)

      const layout: NodeLayout = { kind: "binary", operators: ["#"], operands: [lhs, rhs] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, PRECEDENCE.concat)

      return evaluated(
        reserveNodeID(env),
        layout,
        PRECEDENCE.concat,
        { kind: "list", value: [...listValue(lhs), ...listValue(rhs)] },
        maxReadyRound([lhs, rhs])
      )
    }
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "intDivide":
    case "modulo": {
      const lhs = visitList(env, value.lhs, active)
      const rhs = visitNumber(env, value.rhs, active)

      const precedence =
        value.kind === "add" || value.kind === "subtract" ? PRECEDENCE.additive : PRECEDENCE.multiplicative
      setLeftOperandParentheses(lhs, precedence)
      setRightOperandParentheses(rhs, precedence)

      const operator = listBinaryOperator(value.kind)
      const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, precedence)

      const operation = (item: number): number => {
        switch (value.kind) {
          case "add":
            return item + numberValue(rhs)
          case "subtract":
            return item - numberValue(rhs)
          case "multiply":
            return item * numberValue(rhs)
          case "divide": {
            const divisor = numberValue(rhs)
            if (divisor === 0) throw new RuntimeException("除数不能为零")
            return item / divisor
          }
          case "intDivide": {
            const divisor = numberValue(rhs)
            if (divisor === 0) throw new RuntimeException("除数不能为零")
            return Math.floor(item / divisor)
          }
          case "modulo": {
            const divisor = numberValue(rhs)
            if (divisor === 0) throw new RuntimeException("除数不能为零")
            return item % divisor
          }
          default:
            return assertNever(value)
        }
      }

      return evaluated(
        reserveNodeID(env),
        layout,
        precedence,
        { kind: "list", value: listValue(lhs).map(operation) },
        maxReadyRound([lhs, rhs])
      )
    }
    case "addReverse":
    case "subtractReverse":
    case "multiplyReverse":
    case "divideReverse":
    case "intDivideReverse":
    case "moduloReverse": {
      const lhs = visitNumber(env, value.lhs, active)
      const rhs = visitList(env, value.rhs, active)

      const precedence =
        value.kind === "addReverse" || value.kind === "subtractReverse"
          ? PRECEDENCE.additive
          : PRECEDENCE.multiplicative
      const operator = listBinaryOperator(value.kind)
      setLeftOperandParentheses(lhs, precedence)
      setRightOperandParentheses(rhs, precedence)

      const layout: NodeLayout = { kind: "binary", operators: [operator], operands: [lhs, rhs] }
      if (!active) return shortCircuited(reserveNodeID(env), layout, precedence)

      const operation = (item: number): number => {
        switch (value.kind) {
          case "addReverse":
            return numberValue(lhs) + item
          case "subtractReverse":
            return numberValue(lhs) - item
          case "multiplyReverse":
            return numberValue(lhs) * item
          case "divideReverse": {
            if (item === 0) throw new RuntimeException("除数不能为零")
            return numberValue(lhs) / item
          }
          case "intDivideReverse": {
            if (item === 0) throw new RuntimeException("除数不能为零")
            return Math.floor(numberValue(lhs) / item)
          }
          case "moduloReverse": {
            if (item === 0) throw new RuntimeException("除数不能为零")
            return numberValue(lhs) % item
          }
          default:
            return assertNever(value)
        }
      }

      return evaluated(
        reserveNodeID(env),
        layout,
        precedence,
        { kind: "list", value: listValue(rhs).map(operation) },
        maxReadyRound([lhs, rhs])
      )
    }
    default:
      return assertNever(value)
  }
}
