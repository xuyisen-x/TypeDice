import type { ListBinaryType, ModParamType } from "../hir/types.js"
import { assertNever } from "../utils.js"
import type {
  DicePool,
  DieDetail,
  EvaluatedOutputNode,
  EvaluationEnvironment,
  NodeLayout,
  OutputNode,
  RuntimeValue,
  ShortCircuitedOutputNode,
  SuccessPool,
} from "./types.js"

export function maxReadyRound(nodes: OutputNode[]): number {
  return nodes.reduce((max, node) => {
    return node.status === "evaluated" ? Math.max(max, node.readyRound) : max
  }, 0)
}

export function defaultRandom(face: number | "fudge" | "coin"): number {
  if (face === "fudge") return Math.floor(Math.random() * 3) - 1
  if (face === "coin") return Math.floor(Math.random() * 2)
  return Math.floor(Math.random() * face) + 1
}

export function cloneDetails(details: DieDetail[]): DieDetail[] {
  return details.map((detail) => ({ ...detail }))
}

export function cloneDicePool(pool: DicePool): DicePool {
  return { ...pool, details: cloneDetails(pool.details) }
}

export function cloneSuccessPool(pool: SuccessPool): SuccessPool {
  return { ...pool, details: cloneDetails(pool.details) }
}

export function computeDiceTotal(pool: DicePool): number {
  return pool.details.reduce((total, detail) => total + (detail.isKept ? detail.result : 0), 0)
}

export function computeSuccessCount(pool: SuccessPool): number {
  return pool.details.reduce((total, detail) => {
    if (!detail.isKept) return total
    if (detail.outcome === "success") return total + 1
    if (detail.outcome === "failure") return total - 1
    return total
  }, 0)
}

export function comparatorText(kind: ModParamType["kind"]): string {
  switch (kind) {
    case "equal":
      return "="
    case "notEqual":
      return "!="
    case "greaterThan":
      return ">"
    case "greaterThanOrEqual":
      return ">="
    case "lessThan":
      return "<"
    case "lessThanOrEqual":
      return "<="
    default:
      return assertNever(kind)
  }
}

export function listBinaryOperator(kind: Exclude<ListBinaryType["kind"], "concat">): string {
  switch (kind) {
    case "add":
    case "addReverse":
      return "+"
    case "multiply":
    case "multiplyReverse":
      return "*"
    case "subtract":
    case "subtractReverse":
      return "-"
    case "divide":
    case "divideReverse":
      return "/"
    case "intDivide":
    case "intDivideReverse":
      return "//"
    case "modulo":
    case "moduloReverse":
      return "%"
    default:
      return assertNever(kind)
  }
}

export function compare(kind: ModParamType["kind"], lhs: number, rhs: number): boolean {
  switch (kind) {
    case "equal":
      return lhs === rhs
    case "notEqual":
      return lhs !== rhs
    case "greaterThan":
      return lhs > rhs
    case "greaterThanOrEqual":
      return lhs >= rhs
    case "lessThan":
      return lhs < rhs
    case "lessThanOrEqual":
      return lhs <= rhs
    default:
      return assertNever(kind)
  }
}

export function setLeftOperandParentheses(node: OutputNode, precedence: number): void {
  if (node.precedence < precedence) node.parenthesized = true
}

export function setRightOperandParentheses(node: OutputNode, precedence: number): void {
  if (node.precedence <= precedence) node.parenthesized = true
}

export function prepareBinaryOperands(operands: OutputNode[], precedence: number): void {
  if (operands.length === 0) return
  setLeftOperandParentheses(operands[0], precedence)
  for (const operand of operands.slice(1)) setRightOperandParentheses(operand, precedence)
}

export function evaluated(
  id: number,
  layout: NodeLayout,
  precedence: number,
  value: RuntimeValue,
  readyRound: number
): EvaluatedOutputNode {
  return {
    id,
    parenthesized: false,
    layout,
    precedence,
    status: "evaluated",
    value,
    readyRound,
  }
}

export function shortCircuited(id: number, layout: NodeLayout, precedence: number): ShortCircuitedOutputNode {
  return {
    id,
    parenthesized: false,
    layout,
    precedence,
    status: "short-circuited",
  }
}

export function requireEvaluated(node: OutputNode): EvaluatedOutputNode {
  if (node.status !== "evaluated") throw new Error("Unreachable: expected an evaluated output node")
  return node
}

export function numberValue(node: OutputNode): number {
  const value = requireEvaluated(node).value
  switch (value.kind) {
    case "number":
      return value.value
    case "dicepool":
      return value.value.total
    case "successpool":
      return value.value.successCount
    case "boolean":
    case "list":
      throw new Error(`Unreachable: expected a numeric value, received ${value.kind}`)
    default:
      return assertNever(value)
  }
}

export function booleanValue(node: OutputNode): boolean {
  const value = requireEvaluated(node).value
  if (value.kind !== "boolean") throw new Error(`Unreachable: expected a boolean value, received ${value.kind}`)
  return value.value
}

export function listValue(node: OutputNode): number[] {
  const value = requireEvaluated(node).value
  if (value.kind !== "list") throw new Error(`Unreachable: expected a list value, received ${value.kind}`)
  return value.value
}

export function dicePoolValue(node: OutputNode): DicePool {
  const value = requireEvaluated(node).value
  if (value.kind !== "dicepool") throw new Error(`Unreachable: expected a dice pool, received ${value.kind}`)
  return value.value
}

export function successPoolValue(node: OutputNode): SuccessPool {
  const value = requireEvaluated(node).value
  if (value.kind !== "successpool") throw new Error(`Unreachable: expected a success pool, received ${value.kind}`)
  return value.value
}

export function reserveNodeID(env: EvaluationEnvironment): number {
  return env.nextNodeID++
}

export function getRound(env: EvaluationEnvironment, rollRound: number) {
  if (!env.rollMap.has(rollRound))
    env.rollMap.set(rollRound, {
      roll: [],
      reroll: [],
      explosion: [],
      cover: [],
      remove: [],
    })
  return env.rollMap.get(rollRound)!
}

export function withRollBarrier<T>(env: EvaluationEnvironment, barrier: number, operation: () => T): T {
  const previous = env.rollBarrier
  env.rollBarrier = Math.max(previous, barrier)

  try {
    return operation()
  } finally {
    env.rollBarrier = previous
  }
}
